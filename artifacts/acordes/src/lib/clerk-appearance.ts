import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}/logo.svg`
        : `${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(20, 100%, 55%)",
    colorForeground: "hsl(40, 33%, 96%)",
    colorMutedForeground: "hsl(40, 15%, 70%)",
    colorDanger: "hsl(0, 75%, 60%)",
    colorBackground: "hsl(224, 38%, 9%)",
    colorInput: "hsl(224, 35%, 12%)",
    colorInputForeground: "hsl(40, 33%, 96%)",
    colorNeutral: "hsl(40, 20%, 80%)",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[hsl(224,38%,9%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-white/10 shadow-2xl shadow-black/40",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white text-2xl font-display",
    headerSubtitle: "text-white/70 text-sm",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white/90 font-medium",
    footerActionLink:
      "text-[hsl(20,100%,60%)] hover:text-[hsl(20,100%,70%)] font-medium",
    footerActionText: "text-white/70",
    dividerText: "text-white/50",
    identityPreviewEditButton: "text-[hsl(20,100%,60%)] hover:text-[hsl(20,100%,70%)]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton:
      "bg-white/5 hover:bg-white/10 border border-white/10 transition-colors",
    formButtonPrimary:
      "bg-gradient-to-br from-[hsl(20, 100%, 55%)] to-[hsl(14,90%,42%)] hover:brightness-110 text-white font-semibold shadow-lg shadow-[hsl(20, 100%, 55%)]/20 transition-all",
    formFieldInput:
      "bg-[hsl(224,35%,12%)] border border-white/10 text-white placeholder:text-white/40 focus:border-[hsl(20, 100%, 55%)]",
    footerAction: "text-center",
    dividerLine: "bg-white/10",
    alert: "bg-red-950/40 border border-red-500/30 text-red-200",
    otpCodeFieldInput:
      "bg-[hsl(224,35%,12%)] border border-white/10 text-white",
    formFieldRow: "space-y-1",
    main: "gap-5",
  },
};

export const clerkLocalization = {
  locale: "pt-BR",
  socialButtonsBlockButton: "Continuar com {{provider|titleize}}",
  dividerText: "ou",
  formFieldLabel__emailAddress: "E-mail",
  formFieldLabel__password: "Senha",
  formFieldLabel__confirmPassword: "Confirmar senha",
  formFieldLabel__firstName: "Nome",
  formFieldLabel__lastName: "Sobrenome",
  formButtonPrimary: "Continuar",
  signIn: {
    start: {
      title: "Entrar no Kordi",
      subtitle: "Use o e-mail e senha que você cadastrou",
      actionText: "É seu primeiro acesso?",
      actionLink: "Criar conta",
    },
    password: {
      title: "Digite sua senha",
      subtitle: "Use a senha que você criou no cadastro",
      actionLink: "Esqueci minha senha",
    },
    forgotPasswordAlternativeMethods: {
      title: "Esqueceu sua senha?",
      label__alternative_methods: "Ou tente de outra forma",
      blockButton__resetPassword: "Redefinir senha",
    },
    forgotPassword: {
      title_email: "Verifique seu e-mail",
      subtitle_email: "para receber o código de redefinição",
      formTitle: "Código de redefinição",
      formSubtitle: "Insira o código enviado ao seu e-mail",
      resendButton: "Reenviar código",
    },
    resetPassword: {
      title: "Defina uma nova senha",
      formButtonPrimary: "Redefinir senha",
      successMessage: "Senha alterada. Entrando...",
    },
  },
  signUp: {
    start: {
      title: "Crie sua conta",
      subtitle:
        "Use o mesmo e-mail da compra na Hotmart e crie uma senha de acesso",
      actionText: "Já criou sua conta antes?",
      actionLink: "Entrar",
    },
    emailCode: {
      title: "Confirme seu e-mail",
      subtitle: "Insira o código que enviamos para você",
      formTitle: "Código de verificação",
      formSubtitle: "Insira o código de 6 dígitos enviado ao seu e-mail",
      resendButton: "Reenviar código",
    },
    continue: {
      title: "Falta pouco",
      subtitle: "Complete seu cadastro",
      actionText: "Já tem conta?",
      actionLink: "Entrar",
    },
  },
  userProfile: {
    formButtonPrimary__save: "Salvar",
    formButtonReset: "Cancelar",
  },
  unstable__errors: {
    form_identifier_not_found:
      "E-mail não cadastrado. Use o mesmo e-mail da compra na Hotmart.",
    form_password_incorrect: "Senha incorreta. Tente novamente.",
    form_password_length_too_short: "A senha precisa ter pelo menos 8 caracteres.",
    form_password_no_uppercase: "A senha precisa ter pelo menos uma letra maiúscula.",
    form_password_no_number: "A senha precisa ter pelo menos um número.",
    form_password_no_special_char: "A senha precisa ter pelo menos um caractere especial (!@#$%&*).",
    form_identifier_exists: "Este e-mail já está cadastrado. Faça login.",
  },
};
