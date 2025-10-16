import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading } from '@carbon/react';
import { FormEngine } from '@openmrs/esm-form-engine-lib';
import { launchWorkspace, showModal, type Visit, getCurrentUser } from '@openmrs/esm-framework';
import { clinicalFormsWorkspace, type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import FormError from './form-error.component';
import useFormSchema from '../hooks/useFormSchema';
import styles from './form-renderer.scss';

interface FormRendererProps extends DefaultPatientWorkspaceProps {
  additionalProps?: Record<string, any>;
  encounterUuid?: string;
  formUuid: string;
  patientUuid: string;
  visit?: Visit;
  clinicalFormsWorkspaceName?: string;
}

const TARGET_FORM_UUID = '30413aeb-e448-46c3-b2c1-52e19233906f'; // 👈 replace with your actual form uuid

const FormRenderer: React.FC<FormRendererProps> = ({
  additionalProps,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  encounterUuid,
  formUuid,
  patientUuid,
  promptBeforeClosing,
  visit,
  clinicalFormsWorkspaceName = clinicalFormsWorkspace,
}) => {
  const { t } = useTranslation();
  const { schema, error, isLoading } = useFormSchema(formUuid);

  const openClinicalFormsWorkspaceOnFormClose =
    additionalProps?.openClinicalFormsWorkspaceOnFormClose ?? true;
  const formSessionIntent = additionalProps?.formSessionIntent ?? '*';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const subscription = getCurrentUser().subscribe((user) => {
      setCurrentUser(user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleCloseForm = useCallback(() => {
    closeWorkspace();
    !encounterUuid &&
      openClinicalFormsWorkspaceOnFormClose &&
      launchWorkspace(clinicalFormsWorkspaceName);
  }, [
    closeWorkspace,
    encounterUuid,
    openClinicalFormsWorkspaceOnFormClose,
    clinicalFormsWorkspaceName,
  ]);

  const handleConfirmQuestionDeletion = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const dispose = showModal('form-engine-delete-question-confirm-modal', {
        onCancel() {
          dispose();
          reject();
        },
        onConfirm() {
          dispose();
          resolve();
        },
      });
    });
  }, []);

  const handleMarkFormAsDirty = useCallback(
    (isDirty: boolean) => promptBeforeClosing(() => isDirty),
    [promptBeforeClosing],
  );

  // ✅ Submit handler
  const handleSubmit = useCallback(
    (encounter) => {
      const allowedRoles = ['Provider', 'System Developer', 'self registration'];
      const roles = currentUser?.user?.roles || [];
      const hasTargetRole = roles.some((r: any) =>
        allowedRoles.includes(r.display),
      );

      console.log('Current user:', currentUser);
      console.log('Resolved roles:', roles);
      console.log('Has target role:', hasTargetRole);

      if (formUuid === '30413aeb-e448-46c3-b2c1-52e19233906f') {
        // ✅ Only this form shows popup + redirect
        setShowSuccessModal(true);
      } else {
        // ✅ Other forms save normally
        closeWorkspaceWithSavedChanges(encounter);
      }
    },
    [currentUser, closeWorkspaceWithSavedChanges, formUuid],
  );

  const handleSuccessOk = () => {
    setShowSuccessModal(false);

    if (formUuid === '30413aeb-e448-46c3-b2c1-52e19233906f') {
      // ✅ Redirect to patient summary page after popup
      window.location.href = `/openmrs/spa/home`;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <InlineLoading
          className={styles.loading}
          description={`${t('loading', 'Loading')} ...`}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <FormError closeWorkspace={handleCloseForm} />
      </div>
    );
  }

  return (
    <>
      {schema && (
        <FormEngine
          encounterUUID={encounterUuid}
          formJson={schema}
          handleClose={handleCloseForm}
          handleConfirmQuestionDeletion={handleConfirmQuestionDeletion}
          markFormAsDirty={handleMarkFormAsDirty}
          mode={additionalProps?.mode}
          formSessionIntent={formSessionIntent}
          onSubmit={handleSubmit}
          patientUUID={patientUuid}
        />
      )}

      {/* ✅ Popup only for the target form */}
      {showSuccessModal && formUuid === TARGET_FORM_UUID && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#f8fdf7',
              borderRadius: '1rem',
              padding: '3rem 2rem',
              maxWidth: '650px',
              width: '95%',
              textAlign: 'center',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
            }}
          >
            <h3
              style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#0f5132',
                marginBottom: '1.5rem',
              }}
            >
              धन्यवाद!
            </h3>

            <p
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: '#0f5132',
                marginBottom: '2.5rem',
              }}
            >
              फारम भरिदिनु भएकोमा धन्यवाद। अब कृपया एआरटी काउन्सिलरको परामर्श
              कोठामा जानुहोला। तपाइँलाई लागेको कुरा काउन्सिलरसँग खुल्ला रूपमा
              भन्न सक्नुहुन्छ, र आगामी प्रक्रियामा उहाँले आवश्यक सहयोग
              गर्नुहुनेछ। तपाईंले दिएको जानकारी गोप्य राखिनेछ।
            </p>

            <button
              onClick={handleSuccessOk}
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                padding: '1.2rem 3.5rem',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = '#218838')
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = '#28a745')
              }
            >
              बुझाउनुहोस्
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FormRenderer;
