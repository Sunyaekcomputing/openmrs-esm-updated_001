import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type FormField, type FormSchema, type SessionMode } from '../types';
import { EncounterFormProcessor } from '../processors/encounter/encounter-form-processor';
import {
  type LayoutType,
  useLayoutType,
  type OpenmrsResource,
  showSnackbar,
  showToast,
  type ToastDescriptor,
} from '@openmrs/esm-framework';
import { type FormProcessorConstructor } from '../processors/form-processor';
import { type FormContextProps } from './form-provider';
import { processPostSubmissionActions, validateForm } from './form-factory-helper';
import { useTranslation } from 'react-i18next';
import { usePostSubmissionActions } from '../hooks/usePostSubmissionActions';
import { useExternalFormAction } from '../hooks/useExternalFormAction';

interface FormFactoryProviderContextProps {
  patient: fhir.Patient;
  sessionMode: SessionMode;
  sessionDate: Date;
  formJson: FormSchema;
  formProcessors: Record<string, FormProcessorConstructor>;
  layoutType: LayoutType;
  workspaceLayout: 'minimized' | 'maximized';
  visit: OpenmrsResource;
  location: OpenmrsResource;
  provider: OpenmrsResource;
  isFormExpanded: boolean;
  registerForm: (formId: string, isSubForm: boolean, context: FormContextProps) => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  setIsFormDirty: (isFormDirty: boolean) => void;
}

interface FormFactoryProviderProps {
  patient: fhir.Patient;
  patientUUID: string;
  sessionMode: SessionMode;
  sessionDate: Date;
  formJson: FormSchema;
  workspaceLayout: 'minimized' | 'maximized';
  location: OpenmrsResource;
  provider: OpenmrsResource;
  visit: OpenmrsResource;
  isFormExpanded: boolean;
  children: React.ReactNode;
  formSubmissionProps: {
    isSubmitting: boolean;
    setIsSubmitting: (isSubmitting: boolean) => void;
    onSubmit: (data: any) => void;
    onError: (error: any) => void;
    handleClose: () => void;
  };
  hideFormCollapseToggle: () => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  setIsFormDirty: (isFormDirty: boolean) => void;
}

const FormFactoryProviderContext = createContext<FormFactoryProviderContextProps | undefined>(undefined);

export const FormFactoryProvider: React.FC<FormFactoryProviderProps> = ({
  patient,
  patientUUID,
  sessionMode,
  sessionDate,
  formJson,
  workspaceLayout,
  location,
  provider,
  visit,
  isFormExpanded = true,
  children,
  formSubmissionProps,
  hideFormCollapseToggle,
  handleConfirmQuestionDeletion,
  setIsFormDirty,
}) => {
  const { t } = useTranslation();
  const rootForm = useRef<FormContextProps>();
  const subForms = useRef<Record<string, FormContextProps>>({});
  const layoutType = useLayoutType();
  const { isSubmitting, setIsSubmitting, onSubmit, onError, handleClose } = formSubmissionProps;
  const [isValidating, setIsValidating] = useState(false);
  const postSubmissionHandlers = usePostSubmissionActions(formJson.postSubmissionActions);

  // Each submission gets its own abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  const registerForm = useCallback((formId: string, isSubForm: boolean, context: FormContextProps) => {
    if (isSubForm) {
      subForms.current[formId] = context;
    } else {
      rootForm.current = context;
    }
  }, []);

  const formProcessors = useRef<Record<string, FormProcessorConstructor>>({
    EncounterFormProcessor: EncounterFormProcessor,
  });

  const validateAllForms = useCallback(() => {
    const forms = [rootForm.current, ...Object.values(subForms.current)];
    const isValid = forms.every((formContext) => validateForm(formContext));
    return { forms, isValid };
  }, []);

  useExternalFormAction({
    patientUuid: patientUUID,
    formUuid: formJson?.uuid,
    setIsSubmitting,
    setIsValidating,
  });

  useEffect(() => {
    if (isValidating) {
      validateAllForms();
      setIsValidating(false);
    }
  }, [isValidating, validateAllForms]);

  useEffect(() => {
    if (isSubmitting) {
      const { forms, isValid } = validateAllForms();

      if (!isValid) {
        setIsSubmitting(false);
        return;
      }

      // Create a new controller for this submission
      abortControllerRef.current = new AbortController();
      const controller = abortControllerRef.current;

      Promise.all(forms.map((formContext) => formContext.processor.processSubmission(formContext, controller)))
        .then(async (results) => {
          setIsSubmitting(false);

          showSnackbar({
            title: sessionMode === 'edit' ? t('updatedRecord', 'Record updated') : t('submittedForm', 'Form submitted'),
            subtitle:
              sessionMode === 'edit'
                ? t('updatedRecordDescription', 'The patient encounter was updated')
                : t('submittedFormDescription', 'Form submitted successfully'),
            kind: 'success',
            isLowContrast: true,
          });

          if (postSubmissionHandlers) {
            await processPostSubmissionActions(postSubmissionHandlers, results, patient, sessionMode, t);
          }

          hideFormCollapseToggle();

          if (onSubmit) {
            onSubmit(results);
          } else {
            handleClose();
          }
        })
        .catch((errorObject: Error | ToastDescriptor) => {
          setIsSubmitting(false);
          console.error('[FormFactoryProvider] Submission error:', errorObject);

          if (errorObject instanceof Error) {
            showToast({
              title: t('errorProcessingFormSubmission', 'Error processing form submission'),
              kind: 'error',
              description: errorObject.message,
              critical: true,
            });
          } else {
            showToast(errorObject);
          }
        });
    }

    // Only abort on unmount
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isSubmitting, validateAllForms]);

  return (
    <FormFactoryProviderContext.Provider
      value={{
        patient,
        sessionMode,
        sessionDate,
        formJson,
        formProcessors: formProcessors.current,
        layoutType,
        workspaceLayout,
        visit,
        location,
        provider,
        isFormExpanded,
        registerForm,
        handleConfirmQuestionDeletion,
        setIsFormDirty,
      }}>
      {children}
    </FormFactoryProviderContext.Provider>
  );
};

export const useFormFactory = () => {
  const context = useContext(FormFactoryProviderContext);
  if (!context) {
    throw new Error('useFormFactoryContext must be used within a FormFactoryProvider');
  }
  return context;
};
