import { useMemo, useRef, useState } from "react";
import {
  OPCAO_SIM,
  PORTE_OPTIONS,
  SIM_NAO_OPTIONS,
} from "@veggiedent/content-schema";
import { useLeadForm } from "../hooks/useLeadForm";
import { env } from "../../../config/env";
import { useTracking } from "../../../hooks/useTracking";
import { FormField } from "./FormField";
import { PorteSelect } from "./PorteSelect";
import { ConsentCheckbox } from "./ConsentCheckbox";
import { SuccessModal } from "./SuccessModal";
import { ErrorToast } from "./ErrorToast";
import type { SectionContent } from "../../../content/published-content";
import type { FormOptionView, LeadFormFieldName } from "../CapturaLead.types";

interface LeadCaptureFormProps {
  content: SectionContent<"captura_lead">;
}

/**
 * Junta as duas metades de uma opção do formulário: o **valor** gravado no lead,
 * que e estrutura e vive em codigo, e o **rotulo** lido pelo visitante, que e
 * texto e vive no CMS (T25).
 */
type OptionLabelField =
  | (typeof PORTE_OPTIONS)[number]["labelField"]
  | (typeof SIM_NAO_OPTIONS)[number]["labelField"];

function optionViews(
  options: readonly {
    readonly value: string;
    readonly labelField: OptionLabelField;
  }[],
  content: SectionContent<"captura_lead">,
): FormOptionView[] {
  return options.map((option) => ({
    value: option.value,
    label: content[option.labelField],
  }));
}

// LeadCaptureForm — orquestra os subcomponentes de campo, o hook useLeadForm
// e os estados de sucesso/erro. Todo rotulo, mensagem e opcao vem do CMS
// (Especificacao Funcional, secao 8; SDD, C-10).
export function LeadCaptureForm({ content }: LeadCaptureFormProps) {
  const errorMessages = useMemo(
    () => ({
      nome: content.errorNome,
      email: content.errorEmail,
      aceiteLgpd: content.errorAceiteLgpd,
    }),
    [content.errorNome, content.errorEmail, content.errorAceiteLgpd],
  );
  const { values, errors, status, setValue, handleBlur, submit } =
    useLeadForm(errorMessages);
  const porteOptions = useMemo(
    () => optionViews(PORTE_OPTIONS, content),
    [content],
  );
  const simNaoOptions = useMemo(
    () => optionViews(SIM_NAO_OPTIONS, content),
    [content],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const aceiteLgpdRef = useRef<HTMLInputElement>(null);
  const { track } = useTracking();

  const fieldRefs: Partial<
    Record<LeadFormFieldName, React.RefObject<HTMLInputElement>>
  > = {
    nome: nomeRef,
    email: emailRef,
    aceiteLgpd: aceiteLgpdRef,
  };

  const isSubmitting = status === "submitting" || status === "validating";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await submit();

    if (result === "invalid") {
      const invalidFieldNames = Object.keys(errors) as LeadFormFieldName[];
      const errorCount = invalidFieldNames.length || 1;
      setAnnouncement(
        `Formulário com ${errorCount} campo${errorCount > 1 ? "s" : ""} para corrigir.`,
      );

      const firstInvalidField = invalidFieldNames[0];
      if (firstInvalidField) {
        fieldRefs[firstInvalidField]?.current?.focus();
      }
      return;
    }

    if (result === "success") {
      setIsModalOpen(true);
      if (env.ebookDeliveryMode === "email") {
        track("ebook_download", {
          ebook_id: "guia-saude-bucal-canina",
          delivery_mode: "email",
        });
      }
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div aria-live="assertive" className="sr-only">
          {announcement}
        </div>

        <FormField
          ref={nomeRef}
          label={content.formNomeLabel}
          placeholder={content.formNomePlaceholder}
          value={values.nome}
          onChange={(value) => setValue("nome", value)}
          onBlur={() => handleBlur("nome")}
          error={errors.nome}
          required
        />

        <FormField
          ref={emailRef}
          label={content.formEmailLabel}
          placeholder={content.formEmailPlaceholder}
          value={values.email}
          onChange={(value) => setValue("email", value)}
          onBlur={() => handleBlur("email")}
          error={errors.email}
          required
          type="email"
        />

        {/* Campo condicional — incluir apenas se aprovado pela estrategia (PRD v1.2, secao 18) */}
        <FormField
          label={content.formTelefoneLabel}
          placeholder={content.formTelefonePlaceholder}
          value={values.telefone}
          onChange={(value) => setValue("telefone", value)}
          onBlur={() => handleBlur("telefone")}
        />

        <FormField
          label={content.formNomeCachorroLabel}
          placeholder={content.formNomeCachorroPlaceholder}
          value={values.nomeCachorro}
          onChange={(value) => setValue("nomeCachorro", value)}
          onBlur={() => handleBlur("nomeCachorro")}
        />

        <FormField
          label={content.formCidadeEstadoLabel}
          placeholder={content.formCidadeEstadoPlaceholder}
          value={values.cidadeEstado}
          onChange={(value) => setValue("cidadeEstado", value)}
          onBlur={() => handleBlur("cidadeEstado")}
        />

        <PorteSelect
          label={content.formPorteCachorroLabel}
          placeholder={content.formPorteCachorroPlaceholder}
          options={porteOptions}
          value={values.porteCachorro}
          onChange={(value) => setValue("porteCachorro", value)}
        />

        <div className="flex flex-col gap-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-900">
              {content.formConheceVirbacLabel}
            </legend>

            <div className="flex items-center gap-6">
              {simNaoOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink-700"
                >
                  <input
                    type="radio"
                    name="conheceVirbac"
                    value={option.value}
                    checked={values.conheceVirbac === option.value}
                    onChange={() => setValue("conheceVirbac", option.value)}
                    className="h-4 w-4 accent-brand-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-900">
              {content.formUsaProdutoVirbacLabel}
            </legend>

            <div className="flex items-center gap-6">
              {simNaoOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink-700"
                >
                  <input
                    type="radio"
                    name="usaProdutoVirbac"
                    value={option.value}
                    checked={values.usaProdutoVirbac === option.value}
                    onChange={() => {
                      setValue("usaProdutoVirbac", option.value);
                      // Quem responde que nao usa nenhum produto nao deve enviar
                      // um "qual produto" digitado antes de trocar a resposta.
                      if (option.value !== OPCAO_SIM) {
                        setValue("qualProdutoVirbac", "");
                      }
                    }}
                    className="h-4 w-4 accent-brand-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {values.usaProdutoVirbac === OPCAO_SIM && (
            <FormField
              label={content.formQualProdutoVirbacLabel}
              placeholder={content.formQualProdutoVirbacPlaceholder}
              value={values.qualProdutoVirbac}
              onChange={(value) => setValue("qualProdutoVirbac", value)}
              onBlur={() => handleBlur("qualProdutoVirbac")}
            />
          )}
        </div>

        <ConsentCheckbox
          ref={aceiteLgpdRef}
          label={content.lgpdLabel}
          checked={values.aceiteLgpd}
          onChange={(checked) => setValue("aceiteLgpd", checked)}
          error={errors.aceiteLgpd}
          required
        />

        <ConsentCheckbox
          label={content.optInLabel}
          checked={values.aceiteComunicacoes}
          onChange={(checked) => setValue("aceiteComunicacoes", checked)}
        />

        <button
          ref={submitButtonRef}
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-primary px-6 text-base font-semibold text-ink-900 transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {status === "submitting"
            ? content.submitLoadingLabel
            : content.submitLabel}
        </button>

        {status === "error" && <ErrorToast message={content.errorToastMessage} />}
      </form>

      {isModalOpen && (
        <SuccessModal
          content={content}
          onClose={() => setIsModalOpen(false)}
          triggerRef={submitButtonRef}
        />
      )}
    </>
  );
}
