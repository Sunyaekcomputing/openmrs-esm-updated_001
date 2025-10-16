import { type OpenmrsResource, showSnackbar } from '@openmrs/esm-framework';
import { type FormContextProps } from './form-provider';
import { extractErrorMessagesFromResponse } from '../utils/error-utils';
import { evaluatePostSubmissionExpression } from '../utils/post-submission-action-helper';
import { type PostSubmissionActionMeta } from '../hooks/usePostSubmissionActions';
import { type TFunction } from 'react-i18next';
import { type SessionMode } from '../types';

export function validateForm(context: FormContextProps) {
  const {
    formFields,
    formFieldValidators,
    patient,
    sessionMode,
    addInvalidField,
    updateFormField,
    containerRef, // ✅ make sure FormContextProps includes this
    methods: { getValues },
  } = context;

  const values = getValues();
  const errors = formFields
    .filter(
      (field) =>
        !field.isHidden &&
        !field.isParentHidden &&
        !field.isDisabled &&
        !field.meta.submission?.unspecified,
    )
    .flatMap((field) =>
      field.validators?.flatMap((validatorConfig) => {
        const validator = formFieldValidators[validatorConfig.type];
        if (validator) {
          const validationResults = validator.validate(field, values[field.id], {
            formFields,
            values,
            expressionContext: {
              patient,
              mode: sessionMode,
            },
            ...validatorConfig,
          });
          const errors = validationResults.filter((result) => result.resultType === 'error');
          if (errors.length) {
            field.meta.submission = { ...field.meta.submission, errors };
            updateFormField(field);
            addInvalidField(field);
          }
          return errors;
        }
      }),
    )
    .filter((error) => Boolean(error));

  // 🚀 Scroll to the first invalid field
  if (errors.length > 0) {
    const firstInvalid = formFields.find((f) => f.meta?.submission?.errors?.length);

    if (firstInvalid && containerRef?.current) {
      let el: HTMLElement | null =
        containerRef.current.querySelector<HTMLElement>(`[name="${firstInvalid.id}"]`) ||
        containerRef.current.querySelector<HTMLElement>(`#${firstInvalid.id}`) ||
        containerRef.current.querySelector<HTMLElement>(`[data-field-id="${firstInvalid.id}"]`);

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus?.({ preventScroll: true });
        el.classList.add('scroll-highlight');
        setTimeout(() => el.classList.remove('scroll-highlight'), 3000);
      }
    }

    return false;
  }

  return true;
}

export async function processPostSubmissionActions(
  postSubmissionHandlers: PostSubmissionActionMeta[],
  submissionResults: OpenmrsResource[],
  patient: fhir.Patient,
  sessionMode: SessionMode,
  t: TFunction,
) {
  return Promise.all(
    postSubmissionHandlers.map(async ({ postAction, config, actionId, enabled }) => {
      try {
        const encounterData: any[] = [];
        if (submissionResults) {
          submissionResults.forEach((result) => {
            if (result?.data) {
              encounterData.push(result.data);
            }
            if (result?.uuid) {
              encounterData.push(result);
            }
          });

          if (encounterData.length) {
            const isActionEnabled = enabled ? evaluatePostSubmissionExpression(enabled, encounterData) : true;
            if (isActionEnabled) {
              await postAction.applyAction(
                {
                  patient,
                  sessionMode,
                  encounters: encounterData,
                },
                config,
              );
            }
          } else {
            throw new Error('No encounter data to process post submission action');
          }
        } else {
          throw new Error('No handlers available to process post submission action');
        }
      } catch (error) {
        const errorMessages = extractErrorMessagesFromResponse(error);
        showSnackbar({
          title: t(
            'errorDescriptionTitle',
            actionId ? actionId.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Post Submission Error',
          ),
          subtitle: t('errorDescription', '{{errors}}', { errors: errorMessages.join(', ') }),
          kind: 'error',
          isLowContrast: false,
        });
      }
    }),
  );
}
