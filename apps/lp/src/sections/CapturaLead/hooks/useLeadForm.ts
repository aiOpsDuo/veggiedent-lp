// Hook exclusivo desta secao — Especificacao Funcional, secao 8.4.
import { useCallback, useRef, useState } from "react";
import { useTracking } from "../../../hooks/useTracking";
import { submitLead } from "../services/submitLead";
import { validateField, validateLeadForm } from "../utils/validation";
import type {
  LeadFormErrorMessages,
  LeadFormErrors,
  LeadFormStatus,
  LeadFormValues,
} from "../CapturaLead.types";

const initialValues: LeadFormValues = {
  nome: "",
  email: "",
  telefone: "",
  nomeCachorro: "",
  porteCachorro: "",
  cidadeEstado: "",

  conheceVirbac: "",
  usaProdutoVirbac: "",
  qualProdutoVirbac: "",

  aceiteLgpd: false,
  aceiteComunicacoes: false,
};
/**
 * O estado do formulario. Recebe as mensagens de erro em vez de importa-las
 * porque elas sao conteudo do CMS, e o hook nao fala com o CMS.
 */
export function useLeadForm(errorMessages: LeadFormErrorMessages) {
  const [values, setValues] = useState<LeadFormValues>(initialValues);
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof LeadFormValues, boolean>>
  >({});
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const hasStartedForm = useRef(false);
  const { track } = useTracking();

  const setValue = useCallback(
    <K extends keyof LeadFormValues>(name: K, value: LeadFormValues[K]) => {
      if (!hasStartedForm.current) {
        hasStartedForm.current = true;
        track("form_start", { form_id: "lead_capture" });
      }

      setValues((prev) => ({ ...prev, [name]: value }));

      // Depois do primeiro erro, o campo valida em tempo real a cada change
      // (Especificacao Funcional, secao 8.2).
      if (touched[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: validateField(name, { ...values, [name]: value }, errorMessages),
        }));
      }
    },
    [touched, values, track, errorMessages],
  );

  const handleBlur = useCallback(
    (name: keyof LeadFormValues) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name, values, errorMessages),
      }));
    },
    [values, errorMessages],
  );

  const submit = useCallback(async (): Promise<
    "success" | "error" | "invalid"
  > => {
    setStatus("validating");
    const validationErrors = validateLeadForm(values, errorMessages);
    setErrors(validationErrors);

    const firstInvalidField = Object.keys(validationErrors)[0] as
      | keyof LeadFormValues
      | undefined;
    if (firstInvalidField) {
      setTouched((prev) => ({ ...prev, [firstInvalidField]: true }));
      setStatus("idle");
      return "invalid";
    }

    setStatus("submitting");

    try {
      await submitLead(values);
      setStatus("success");
      track("form_submit_success", { form_id: "lead_capture" });
      return "success";
    } catch (error) {
      setStatus("error");
      track("form_submit_error", {
        form_id: "lead_capture",
        error_type: "network_or_server",
      });
      return "error";
    }
  }, [values, track, errorMessages]);

  return { values, errors, status, setValue, handleBlur, submit };
}
