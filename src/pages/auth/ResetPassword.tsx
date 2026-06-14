import { type FormEvent, useState } from "react";
import eyeIcon from "../../assets/auth/password-reset/reset-eye-icon.svg";
import headerIcon from "../../assets/auth/password-reset/reset-header-icon.svg";
import submitIcon from "../../assets/auth/password-reset/reset-submit-icon.svg";
import "../../styles/auth/PasswordReset.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

type ResetPasswordProps = {
  onBackToLogin?: () => void;
  onResetSuccess?: () => void;
  token?: string | null;
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

const validatePassword = (password: string) => {
  if (!password.trim()) {
    return "Kata sandi baru harus diisi.";
  }

  if (password.length < 8) {
    return "Kata sandi baru minimal 8 karakter.";
  }

  if (password.length > 255) {
    return "Kata sandi baru maksimal 255 karakter.";
  }

  return null;
};

export const ResetPassword = ({
  onResetSuccess,
  token,
}: ResetPasswordProps) => {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(
    token
      ? null
      : {
          message:
            "Link reset kata sandi tidak valid. Silakan minta instruksi baru.",
          type: "error",
        },
  );

  const validateForm = () => {
    const errors: {
      password?: string;
      passwordConfirmation?: string;
    } = {};
    const passwordError = validatePassword(password);

    if (passwordError) {
      errors.password = passwordError;
    }

    if (!passwordConfirmation) {
      errors.passwordConfirmation = "Konfirmasi kata sandi baru harus diisi.";
    } else if (password !== passwordConfirmation) {
      errors.passwordConfirmation = "Konfirmasi kata sandi baru belum sama.";
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!token) {
      setFeedback({
        message: "Link reset kata sandi tidak valid. Silakan minta instruksi baru.",
        type: "error",
      });
      return;
    }

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        body: JSON.stringify({
          password,
          passwordConfirmation,
          token,
        }),
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
        message: result.message ?? "Kata sandi berhasil diperbarui.",
        type: "success",
      });
      window.setTimeout(() => onResetSuccess?.(), 900);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Kata sandi gagal diperbarui.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="password-recovery-page password-recovery-page--reset">
      <section
        className="password-recovery-card password-recovery-card--reset"
        aria-labelledby="reset-title"
      >
        <header className="password-recovery-header password-recovery-header--reset">
          <span className="password-recovery-header__icon" aria-hidden="true">
            <img src={headerIcon} alt="" />
          </span>
          <h1 id="reset-title">Atur Ulang Kata Sandi</h1>
          <p>
            Buat kata sandi baru yang kuat untuk menjaga keamanan akun Survey
            Jogja Anda.
          </p>
        </header>

        <form className="password-recovery-form" onSubmit={handleSubmit}>
          <div className="password-recovery-field">
            <label htmlFor="new-password">Kata Sandi Baru</label>
            <div
              className={`password-recovery-field__control password-recovery-field__control--plain${
                fieldErrors.password
                  ? " password-recovery-field__control--error"
                  : ""
              }`}
            >
              <input
                autoComplete="new-password"
                id="new-password"
                name="password"
                onChange={(event) => {
                  const value = event.target.value;
                  setPassword(value);
                  setFeedback(null);
                  setFieldErrors((current) => ({
                    ...current,
                    password: validatePassword(value) ?? undefined,
                    passwordConfirmation:
                      passwordConfirmation && value !== passwordConfirmation
                        ? "Konfirmasi kata sandi baru belum sama."
                        : undefined,
                  }));
                }}
                placeholder="Minimal 8 karakter"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={
                  showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                }
                className="password-recovery-field__toggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <img src={eyeIcon} alt="" />
              </button>
            </div>
            {fieldErrors.password && (
              <p className="password-recovery-field__error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="password-recovery-field">
            <label htmlFor="new-password-confirmation">
              Konfirmasi Kata Sandi Baru
            </label>
            <div
              className={`password-recovery-field__control password-recovery-field__control--plain${
                fieldErrors.passwordConfirmation
                  ? " password-recovery-field__control--error"
                  : ""
              }`}
            >
              <input
                autoComplete="new-password"
                id="new-password-confirmation"
                name="passwordConfirmation"
                onChange={(event) => {
                  const value = event.target.value;
                  setPasswordConfirmation(value);
                  setFeedback(null);
                  setFieldErrors((current) => ({
                    ...current,
                    passwordConfirmation:
                      !value || value === password
                        ? undefined
                        : "Konfirmasi kata sandi baru belum sama.",
                  }));
                }}
                placeholder="Ulangi kata sandi baru"
                type={showPasswordConfirmation ? "text" : "password"}
                value={passwordConfirmation}
              />
              <button
                aria-label={
                  showPasswordConfirmation
                    ? "Sembunyikan konfirmasi kata sandi"
                    : "Tampilkan konfirmasi kata sandi"
                }
                className="password-recovery-field__toggle"
                onClick={() =>
                  setShowPasswordConfirmation((current) => !current)
                }
                type="button"
              >
                <img src={eyeIcon} alt="" />
              </button>
            </div>
            {fieldErrors.passwordConfirmation && (
              <p className="password-recovery-field__error">
                {fieldErrors.passwordConfirmation}
              </p>
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
            disabled={isSubmitting || !token}
            type="submit"
          >
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi"}</span>
            <img src={submitIcon} alt="" aria-hidden="true" />
          </button>
        </form>
      </section>

      <footer className="password-recovery-footer">
        &copy; 2026 Pemerintah Kota Yogyakarta. All rights reserved.
      </footer>
    </main>
  );
};
