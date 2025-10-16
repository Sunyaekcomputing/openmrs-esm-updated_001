import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { Button, ButtonSet, InlineLoading, Modal } from '@carbon/react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { useSession, type Visit } from '@openmrs/esm-framework';
import { FormFactoryProvider } from './provider/form-factory-provider';
import { init, teardown } from './lifecycle';
import { isEmpty, useFormJson } from '.';
import { formEngineAppName } from './globals';
import { reportError } from './utils/error-utils';
import { useFormCollapse } from './hooks/useFormCollapse';
import { useFormWorkspaceSize } from './hooks/useFormWorkspaceSize';
import { usePageObserver } from './components/sidebar/usePageObserver';
import { usePatientData } from './hooks/usePatientData';
import type { FormField, FormSchema, SessionMode, PreFilledQuestions } from './types';
import FormProcessorFactory from './components/processor-factory/form-processor-factory.component';
import Loader from './components/loaders/loader.component';
import MarkdownWrapper from './components/inputs/markdown/markdown-wrapper.component';
import PatientBanner from './components/patient-banner/patient-banner.component';
import Sidebar from './components/sidebar/sidebar.component';
import styles from './form-engine.scss';

interface FormEngineProps {
  patientUUID: string;
  formUUID?: string;
  formJson?: FormSchema;
  encounterUUID?: string;
  visit?: Visit;
  formSessionIntent?: string;
  mode?: SessionMode;
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  handleClose?: () => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  markFormAsDirty?: (isDirty: boolean) => void;
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  preFilledQuestions?: PreFilledQuestions;
}

const FormEngine = ({
  formJson,
  patientUUID,
  formUUID,
  encounterUUID,
  visit,
  formSessionIntent,
  mode,
  onSubmit,
  onCancel,
  handleClose,
  handleConfirmQuestionDeletion,
  markFormAsDirty,
  hideControls = false,
  hidePatientBanner = false,
  preFilledQuestions,
}: FormEngineProps) => {
  const { t } = useTranslation();
  const session = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const sessionDate = useMemo(() => new Date(), []);
  const workspaceSize = useFormWorkspaceSize(formRef as unknown as React.RefObject<HTMLDivElement>);
  const { patient, isLoadingPatient } = usePatientData(patientUUID);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const sessionMode = !isEmpty(mode) ? mode : !isEmpty(encounterUUID) ? 'edit' : 'enter';
  const { isFormExpanded, hideFormCollapseToggle } = useFormCollapse(sessionMode);
  const { hasMultiplePages } = usePageObserver();

  const { formJson: refinedFormJson, isLoading: isLoadingFormJson, formError } = useFormJson(
    formUUID,
    formJson,
    encounterUUID,
    formSessionIntent,
    preFilledQuestions
  );

  const showPatientBanner = useMemo(() => {
    if (hidePatientBanner) return false;
    return patient && workspaceSize === 'ultra-wide' && mode !== 'embedded-view';
  }, [patient, mode, workspaceSize, hidePatientBanner]);

  const isFormWorkspaceTooNarrow = useMemo(() => ['narrow'].includes(workspaceSize), [workspaceSize]);

  const showBottomButtonSet = useMemo(() => {
    if (mode === 'embedded-view' || isLoadingDependencies || hasMultiplePages === null) return false;
    return isFormWorkspaceTooNarrow || !hasMultiplePages;
  }, [mode, isFormWorkspaceTooNarrow, isLoadingDependencies, hasMultiplePages]);

  const showSidebar = useMemo(() => {
    if (mode === 'embedded-view' || isLoadingDependencies || hasMultiplePages === null) return false;
    return !isFormWorkspaceTooNarrow && hasMultiplePages;
  }, [isFormWorkspaceTooNarrow, isLoadingDependencies, hasMultiplePages]);

  useEffect(() => {
    reportError(formError, t('errorLoadingFormSchema', 'Error loading form schema'));
  }, [formError]);

  useEffect(() => {
    init();
    return () => teardown();
  }, []);

  useEffect(() => {
    markFormAsDirty?.(isFormDirty);
  }, [isFormDirty]);

  const getAllFieldData = () => {
    if (!formRef.current || !refinedFormJson) return { fields: [], fieldData: {} };

    const inputs = Array.from(
      formRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
    );

    const fields: any[] = [];
    const fieldData: Record<string, any> = {};
    const processedRadioGroups: Set<string> = new Set();
    const processedCheckboxGroups: Set<string> = new Set();

    inputs.forEach((input) => {
      const questionId = input.name;
      let matchedField: FormField | undefined;
      for (const page of refinedFormJson.pages) {
        for (const section of page.sections) {
          matchedField = section.questions.find((q) => q.id === questionId);
          if (matchedField) break;
        }
        if (matchedField) break;
      }

      let value: any;
      if (input.type === 'radio') {
        if (!processedRadioGroups.has(questionId)) {
          const selected = formRef.current.querySelector<HTMLInputElement>(
            `input[type="radio"][name="${questionId}"]:checked`
          );
          value = selected ? selected.value : null;
          processedRadioGroups.add(questionId);
        } else return;
      } else if (input.type === 'checkbox') {
        if (!processedCheckboxGroups.has(questionId)) {
          const checkedBoxes = Array.from(
            formRef.current.querySelectorAll<HTMLInputElement>(
              `input[type="checkbox"][name="${questionId}"]:checked`
            )
          );
          value = checkedBoxes.map((c) => c.value);
          processedCheckboxGroups.add(questionId);
        } else return;
      } else {
        value = input.value;
      }

      const isFilled =
        value !== null &&
        value !== undefined &&
        (Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' || value !== '');

      const isRequiredFromJson =
        matchedField?.isRequired === true || matchedField?.required === true || matchedField?.required === 'true';

      let isRequiredFromDom = false;
      const labelEl = formRef.current.querySelector(`label[for="${input.id}"]`);
      if (labelEl) {
        const requiredSpan = labelEl.querySelector('span[title="Required"]');
        if (requiredSpan) isRequiredFromDom = true;
      }

      const isRequired = isRequiredFromJson || isRequiredFromDom;

      fields.push({
        fieldId: questionId,
        fieldLabel: input.getAttribute('data-label') || matchedField?.label || questionId,
        value,
        isFilled,
        isRequired,
        inputEl: input,
      });

      fieldData[questionId] = { value, isFilled, isRequired };
    });

    return { fields, fieldData };
  };

  const scrollToMissingRequiredField = () => {
    const { fields } = getAllFieldData?.() || { fields: [] };
    const missingRequired = fields.find((f) => f.isRequired && !f.isFilled);
  
    if (missingRequired) {
      const el = missingRequired.inputEl as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('scroll-required-highlight');
        setTimeout(() => el.classList.remove('scroll-required-highlight'), 2000);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus();
      }
    }
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
  
      const { fields, fieldData } = getAllFieldData();
      const missingRequired = fields.find((f) => f.isRequired && !f.isFilled);
  
      if (missingRequired) {
        scrollToMissingRequiredField();
        setIsSubmitting(false);
        return;
      }
  
      onSubmit?.(fieldData);
      setIsSubmitting(true);
    },
    [onSubmit, refinedFormJson]
  );

  const handleDiscardConfirm = () => {
    setShowDiscardModal(false);
    window.location.href = '/openmrs/spa/home';
  };

  const handleDiscardCancel = () => {
    setShowDiscardModal(false);
  };

  return (
    <form ref={formRef} noValidate className={classNames('cds--form', styles.form)} onSubmit={handleSubmit}>
      {isLoadingPatient || isLoadingFormJson ? (
        <Loader />
      ) : (
        <FormFactoryProvider
          patient={patient}
          patientUUID={patientUUID}
          sessionMode={sessionMode}
          sessionDate={sessionDate}
          formJson={refinedFormJson}
          workspaceLayout={workspaceSize === 'ultra-wide' ? 'maximized' : 'minimized'}
          location={session?.sessionLocation}
          provider={session?.currentProvider}
          visit={visit}
          handleConfirmQuestionDeletion={handleConfirmQuestionDeletion}
          isFormExpanded={isFormExpanded}
          formSubmissionProps={{
            isSubmitting,
            setIsSubmitting,
            onSubmit,
            onError: () => {},
            handleClose: () => {},
          }}
          hideFormCollapseToggle={hideFormCollapseToggle}
          setIsFormDirty={setIsFormDirty}>
          <div className={styles.formContainer}>
            {isLoadingDependencies && (
              <div className={styles.linearActivity}>
                <div className={styles.indeterminate}></div>
              </div>
            )}
            <div className={styles.formContent}>
              {showSidebar && (
                <Sidebar
                  isFormSubmitting={isSubmitting}
                  sessionMode={mode}
                  defaultPage={refinedFormJson.defaultPage}
                  onCancel={onCancel}
                  handleClose={handleClose}
                  hideFormCollapseToggle={hideFormCollapseToggle}
                  hideControls={hideControls}
                />
              )}
              <div className={styles.formContentInner}>
                {showPatientBanner && <PatientBanner patient={patient} hideActionsOverflow />}
                {refinedFormJson.markdown && (
                  <div className={styles.markdownContainer}>
                    <MarkdownWrapper markdown={refinedFormJson.markdown} />
                  </div>
                )}
                <div className={styles.formBody}>
                  <FormProcessorFactory
                    formJson={refinedFormJson}
                    setIsLoadingFormDependencies={setIsLoadingDependencies}
                  />
                </div>
                {showBottomButtonSet && !hideControls && (
                  <ButtonSet className={styles.minifiedButtons}>
                   <Button
                        kind="secondary"
                        style={{ backgroundColor: 'grey', color: 'white' }}
                        onClick={() => {
                          if (isFormDirty) {
                            setShowDiscardModal(true);
                          } else {
                            window.location.href = '/openmrs/spa/home';
                          }
                        }}
                      >
                        रद्द गर्नुहोस्
                      </Button>
                      <Button
                        className={styles.saveButton}
                        disabled={isLoadingDependencies || isSubmitting || mode === 'view'}
                        kind="primary"
                        type="submit"
                      >
                        {isSubmitting ? (
                          <InlineLoading description={t('submitting', 'Submitting') + '...'} />
                        ) : (
                          <span>बुझाउनुहोस्</span>
                        )}
                      </Button>

                  </ButtonSet>
                )}
              </div>
            </div>
          </div>
        </FormFactoryProvider>
      )}

      {/* ✅ Discard confirmation modal in Nepali */}
      <Modal
  open={showDiscardModal}
  modalHeading={
    <span style={{ fontSize: '2rem', fontWeight: 700 }}>
     के तपाई यो प्रश्नावली रद्द गर्न चाहनुहुन्छ?
    </span>
  }
  primaryButtonText={
    <span style={{ color: 'white' }}>चाहन्छु</span>
  }
  secondaryButtonText={
    <span style={{ color: 'white' }}>चाहन्न</span>
  }
  onRequestSubmit={handleDiscardConfirm}
  onRequestClose={handleDiscardCancel}
  // style={{ '--primary-button-bg': 'red', '--secondary-button-bg': 'green' } as React.CSSProperties}
>
  {/* <p style={{ fontSize: '1.75rem', fontWeight: 600 }}>
    ⚠️ तपाईँले गरेका परिवर्तनहरू हट्छन्।
  </p> */}
</Modal>

    </form>
  );
};

function I18FormEngine(props: FormEngineProps) {
  return (
    <I18nextProvider i18n={window.i18next} defaultNS={formEngineAppName}>
      <FormEngine {...props} />
    </I18nextProvider>
  );
}


export default I18FormEngine;