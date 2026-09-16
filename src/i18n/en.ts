/**
 * Phase 12 — English translation dictionary (DEFAULT_LOCALE).
 *
 * This is the canonical shape that the Persian dictionary (`fa.ts`) MUST match.
 * Missing keys in `fa.ts` fall back to the English value via the `translate`
 * function in `src/i18n/index.ts`.
 *
 * SERVICE NAMES (Verify / Send / Broadcast / Flow / Audience / Events / Relay /
 * Insights) remain canonical English in BOTH dictionaries — they are product
 * names and are NOT translated. They appear in the sidebar and elsewhere as
 * their canonical English form.
 *
 * Only UI shell strings are localized — not user-generated content, API error
 * codes, JSON keys, enum values, or HTTP headers.
 */

export const en = {
  common: {
    buttons: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirm: "Confirm",
      back: "Back",
      loading: "Loading…",
    },
    status: {
      sent: "Sent",
      failed: "Failed",
      pending: "Pending",
      active: "Active",
      inactive: "Inactive",
    },
  },

  auth: {
    signIn: {
      title: "Welcome back",
      subtitle: "Log in to your Nixify account.",
      email: "Email",
      password: "Password",
      submit: "Log in",
      forgotPassword: "Forgot password?",
      submitting: "Logging in…",
      noAccount: "Don't have an account?",
      signUpLink: "Sign up",
    },
    signUp: {
      title: "Create your account",
      subtitle: "We'll email you a 6-digit verification code.",
      submit: "Create account",
      submitting: "Creating account…",
      haveAccount: "Already have an account?",
      logInLink: "Log in",
      passwordHelp: "Use at least 8 characters.",
    },
    forgotPassword: {
      title: "Reset your password",
      subtitle: "Enter your email and we'll send a 6-digit reset code.",
      email: "Email",
      submit: "Send reset code",
      submitting: "Sending…",
      backToLogin: "Back to log in",
      rememberedIt: "Remembered it?",
      successTitle: "Reset code sent",
      successDescription: "If an account exists, a reset code was sent.",
    },
    resetPassword: {
      title: "Set a new password",
      password: "New password",
      confirm: "Confirm password",
      submit: "Update password",
    },
    verifyEmail: {
      title: "Verify your email",
      subtitle: "Enter the 6-digit code we sent to your inbox.",
      code: "Verification code",
      resend: "Resend code",
      verifying: "Verifying…",
    },
    logout: "Log out",
  },

  dashboard: {
    nav: {
      dashboard: "Dashboard",
      activity: "Activity",
      emails: "Emails",
      contacts: "Contacts",
      suppressions: "Suppressions",
      // Canonical product name — do NOT translate.
      broadcasts: "Broadcasts",
      templates: "Templates",
      automations: "Automations",
      analytics: "Analytics",
      branding: "Branding",
      apiKeys: "API Keys",
      webhooks: "Webhooks",
      playground: "Playground",
      logs: "Logs",
      docs: "Docs",
      notifications: "Notifications",
      settings: "Settings",
    },
    overview: {
      title: "Dashboard",
      subtitle: "Welcome back to your Nixify workspace.",
      welcome: "Welcome back",
      yourWidgets: "Your Widgets",
      noWidgets: "No widgets enabled.",
      addFirstWidget: "Add your first widget →",
    },
    settings: {
      title: "Settings",
      subtitle: "Manage your account and preferences.",
      localePreference: "Language preference",
      localePreferenceHelp:
        "Choose the language used across the Nixify dashboard. Persian renders right-to-left.",
      language: "Language",
    },
  },

  locale: {
    switcher: {
      title: "Language",
      english: "English",
      persian: "فارسی",
      changeLanguage: "Change language",
    },
  },

  errors: {
    invalidEmail: "Enter a valid email address",
    required: "This field is required",
    tooShort: "Too short",
    generic: "Something went wrong. Please try again.",
    networkError: "Network error. Could not reach the server.",
  },
};

/**
 * Recursive dictionary type — every leaf is `string`. We strip the literal
 * types from the value positions so the Persian dictionary (`fa.ts`) can
 * supply Persian translations for the same keys.
 */
export type Dict = {
  [K in keyof typeof en]: RecurseToString<(typeof en)[K]>;
};

type RecurseToString<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: RecurseToString<T[K]> }
    : T;
