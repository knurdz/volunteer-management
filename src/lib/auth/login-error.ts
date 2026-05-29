type AppwriteOAuthError = {
  code?: number;
  message?: string;
  type?: string;
};

export type LoginErrorMessage = {
  details?: string;
  title: string;
};

const fallbackError: LoginErrorMessage = {
  details: "Try signing in again. If it repeats, check the Appwrite auth setup.",
  title: "Login failed",
};

export function getLoginErrorMessage(rawError?: string): LoginErrorMessage | null {
  if (!rawError) {
    return null;
  }

  const parsed = parseAppwriteOAuthError(rawError);
  const message = parsed?.message ?? rawError;

  if (
    parsed?.type === "user_oauth2_bad_request" &&
    message.toLowerCase().includes("client_secret is missing")
  ) {
    return {
      details:
        "Add the Google OAuth client secret to Appwrite, or set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env and run npm run setup:appwrite:oauth.",
      title: "Google OAuth client secret is missing",
    };
  }

  if (rawError === "oauth_failed") {
    return {
      details:
        "Appwrite could not complete Google OAuth. Check the Google provider credentials and callback URL in Appwrite.",
      title: "Google login was rejected",
    };
  }

  if (rawError === "callback_failed") {
    return {
      details:
        "The Google login returned to the app, but the local session/profile setup failed. Check the terminal for the sanitized auth callback log.",
      title: "Login callback failed",
    };
  }

  if (rawError === "missing_callback") {
    return {
      details: "Google returned without the required Appwrite user token.",
      title: "Login callback was incomplete",
    };
  }

  if (rawError === "session_secret_missing") {
    return {
      details: "Appwrite created a session response without a usable session secret.",
      title: "Appwrite session was incomplete",
    };
  }

  return parsed?.message ? { details: parsed.message, title: "Login failed" } : fallbackError;
}

function parseAppwriteOAuthError(rawError: string): AppwriteOAuthError | null {
  try {
    const parsed = JSON.parse(rawError) as AppwriteOAuthError;

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
