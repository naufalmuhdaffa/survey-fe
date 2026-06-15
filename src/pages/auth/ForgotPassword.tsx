import { type FormEvent, useState } from "react";
import backIcon from "../../assets/auth/password-reset/forgot-back-icon.svg";
import brandIcon from "../../assets/auth/password-reset/forgot-brand-icon.svg";
import emailIcon from "../../assets/auth/password-reset/forgot-email-icon.svg";
import submitIcon from "../../assets/auth/password-reset/forgot-submit-icon.svg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/auth/PasswordReset.scss";

type ForgotPasswordProps = {
  onBackToLogin?: () => void;
};

type ApiResult = {
  message?: string;
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateEmail = (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "Email harus diisi.";
  }

  if (normalizedEmail.length > 255) {
    return "Email maksimal 255 karakter.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Format email tidak valid.";
  }

  return null;
};

export const ForgotPassword = ({ onBackToLogin }: ForgotPasswordProps) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);

    if (nextEmailError) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        body: JSON.stringify({ email: normalizeEmail(email) }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult;
      setFeedback({
        message:
          result.message ??
          "Jika email terdaftar, instruksi pemulihan kata sandi akan dikirim.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Instruksi pemulihan gagal dikirim.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="password-recovery-page password-recovery-page--forgot">
      <section className="password-recovery-shell" aria-labelledby="forgot-title">
        <div className="password-recovery-brand">
          <span className="password-recovery-brand__mark" aria-hidden="true">
            <img src={brandIcon} alt="" />
          </span>
          <strong>Survey Jogja</strong>
        </div>

        <div className="password-recovery-card">
          <header className="password-recovery-header">
            <h1 id="forgot-title">Lupa Kata Sandi?</h1>
            <p>
              Masukkan alamat email Anda untuk menerima instruksi pemulihan kata
              sandi.
            </p>
          </header>

          <form className="password-recovery-form" onSubmit={handleSubmit}>
            <div className="password-recovery-field">
              <label htmlFor="forgot-email">Email</label>
              <div
                className={`password-recovery-field__control${
                  emailError ? " password-recovery-field__control--error" : ""
                }`}
              >
                <img src={emailIcon} alt="" aria-hidden="true" />
                <input
                  autoComplete="email"
                  id="forgot-email"
                  inputMode="email"
                  name="email"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFeedback(null);
                    setEmailError(validateEmail(event.target.value));
                  }}
                  placeholder="contoh@email.com"
                  type="email"
                  value={email}
                />
              </div>
              {emailError && (
                <p className="password-recovery-field__error">{emailError}</p>
              )}
            </div>

            {feedback && (
              <p
                className={`password-recovery-feedback password-recovery-feedback--${feedback.type}`}
              >
                {feedback.message}
              </p>
            )}

            <button
              className="password-recovery-submit"
              disabled={isSubmitting}
              type="submit"
            >
              <span>{isSubmitting ? "Mengirim..." : "Kirim Instruksi"}</span>
              <img src={submitIcon} alt="" aria-hidden="true" />
            </button>
          </form>

          <div className="password-recovery-back">
            <button onClick={onBackToLogin} type="button">
              <img src={backIcon} alt="" aria-hidden="true" />
              Kembali ke Login
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
