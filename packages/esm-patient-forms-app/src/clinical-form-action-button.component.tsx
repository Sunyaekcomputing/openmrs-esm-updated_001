import React, { useEffect, useRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionMenuButton,
  DocumentIcon,
  launchWorkspace,
  useWorkspaces,
  getCurrentUser,
} from '@openmrs/esm-framework';
import {
  clinicalFormsWorkspace,
  formEntryWorkspace,
  htmlFormEntryWorkspace,
} from '@openmrs/esm-patient-common-lib';

const FORM_UUID = 'effc3190-3189-4fc2-9a19-ffee5d5ece95';

function getPatientUuidFromUrl(): string | null {
  const match = window.location.pathname.match(/\/patient\/([^/]+)/);
  return match ? match[1] : null;
}

const ClinicalFormActionButton: React.FC = () => {
  const { t } = useTranslation();
  const { workspaces } = useWorkspaces();
  const hasLaunchedRef = useRef(false);

  const formEntryWorkspaces = workspaces.filter((w) => w.name === formEntryWorkspace);
  const recentlyOpenedForm = formEntryWorkspaces[0];

  const htmlFormEntryWorkspaces = workspaces.filter((w) => w.name === htmlFormEntryWorkspace);
  const recentlyOpenedHtmlForm = htmlFormEntryWorkspaces[0];

  const isFormOpen = formEntryWorkspaces?.length >= 1;
  const isHtmlFormOpen = htmlFormEntryWorkspaces?.length >= 1;

  const launchPatientWorkspaceCb = () => {
    if (isFormOpen) {
      launchWorkspace(formEntryWorkspace, {
        workspaceTitle: recentlyOpenedForm?.additionalProps?.['workspaceTitle'],
        additionalProps: { visitUuid: null },
      });
    } else if (isHtmlFormOpen) {
      launchWorkspace(htmlFormEntryWorkspace, {
        workspaceTitle: recentlyOpenedHtmlForm?.additionalProps?.['workspaceTitle'],
        additionalProps: { visitUuid: null },
      });
    } else {
      launchWorkspace(clinicalFormsWorkspace, {
        additionalProps: { visitUuid: null },
      });
    }
  };

  useEffect(() => {
    const patientUuid = getPatientUuidFromUrl();
    console.log('Resolved patientUuid from URL:', patientUuid);

    if (!patientUuid || hasLaunchedRef.current) return;

    const sub = getCurrentUser().subscribe((session) => {
      const user = session?.user;
      if (!user) return;

      const isAllowed = !user.roles?.some((r) => r.display === 'Self-Registration');
      if (!isAllowed) return;

      hasLaunchedRef.current = true;

      console.log('Auto-launching form for patient:', patientUuid);

      setTimeout(() => {
        launchWorkspace(formEntryWorkspace, {
          workspaceTitle: 'काउन्सिलर फारम',
          formInfo: {
            patientUuid,
            formUuid: FORM_UUID,
            encounterUuid: undefined,
            visitUuid: undefined,
            visitTypeUuid: undefined,
            visitStartDatetime: undefined,
            visitStopDatetime: undefined,
            htmlForm: null,
          },
        });
      }, 300);
    });

    return () => sub.unsubscribe();
  }, []);

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('clinicalForms', 'Clinical forms')}
      iconDescription={t('clinicalForms', 'Clinical forms')}
      handler={launchPatientWorkspaceCb}
      type={'clinical-form'}
    />
  );
};

export default ClinicalFormActionButton;
