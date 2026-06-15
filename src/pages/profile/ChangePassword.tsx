import { type FormEvent, useState } from "react";
import backIcon from "../../assets/auth/password-reset/forgot-back-icon.svg";
import eyeIcon from "../../assets/auth/password-reset/reset-eye-icon.svg";
import headerIcon from "../../assets/auth/password-reset/reset-header-icon.svg";
import submitIcon from "../../assets/auth/password-reset/reset-submit-icon.svg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/auth/PasswordReset.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";

type ChangePasswordProps = {
  onBackToProfile?: () => void;
  onChangeSuccess?: () => void;
  onUnauthorized?: () => void;
};

type ApiResult = {
  message?: string;
};

type PasswordField = "currentPassword" | "password" | "passwordConfirmation";

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
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

export const ChangePassword = ({
  onBackToProfile,
  onChangeSuccess,
  onUnauthorized,
}: ChangePasswordProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [visibleFields, setVisibleFields] = useState<
    Record<PasswordField, boolean>
  >({
    currentPassword: false,
    password: false,
    passwordConfirmation: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<PasswordField, string>>
  >({});
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const validateForm = () => {
    const errors: Partial<Record<PasswordField, string>> = {};
    const passwordError = validatePassword(password);

    if (!currentPassword.trim()) {
      errors.currentPassword = "Kata sandi saat ini harus diisi.";
    }

    if (passwordError) {
      errors.password = passwordError;
    } else if (currentPassword && currentPassword === password) {
      errors.password =
        "Kata sandi baru harus berbeda dari kata sandi saat ini.";
    }

    if (!passwordConfirmation) {
      errors.passwordConfirmation = "Konfirmasi kata sandi baru harus diisi.";
    } else if (password !== passwordConfirmation) {
      errors.passwordConfirmation = "Konfirmasi kata sandi baru belum sama.";
    }

    return errors;
  };

  const toggleField = (field: PasswordField) => {
    setVisibleFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile/password`, {
        body: JSON.stringify({
          currentPassword,
          password,
          passwordConfirmation,
        }),
        credentials: "include",
        headers: authHeaders(),
        method: "POST",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult;
      setFeedback({
        message: result.message ?? "Kata sandi berhasil diperbarui.",
        type: "success",
      });
      window.setTimeout(() => onChangeSuccess?.(), 900);
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

  const handlePasswordChange = (value: string) => {
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
  };

  const handlePasswordConfirmationChange = (value: string) => {
    setPasswordConfirmation(value);
    setFeedback(null);
    setFieldErrors((current) => ({
      ...current,
      passwordConfirmation:
        !value || value === password
          ? undefined
          : "Konfirmasi kata sandi baru belum sama.",
    }));
  };

  return (
    <main className="password-recovery-page password-recovery-page--reset password-recovery-page--change">
      <section
        className="password-recovery-card password-recovery-card--reset password-recovery-card--change"
        aria-labelledby="change-password-title"
      >
        <header className="password-recovery-header password-recovery-header--reset">
          <span className="password-recovery-header__icon" aria-hidden="true">
            <img src={headerIcon} alt="" />
          </span>
          <h1 id="change-password-title">Ubah Kata Sandi</h1>
          <p>
            Masukkan kata sandi saat ini, lalu buat kata sandi baru untuk akun
            Survey Jogja Anda.
          </p>
        </header>

        <form className="password-recovery-form" onSubmit={handleSubmit}>
          <div className="password-recovery-field">
            <label htmlFor="current-password">Kata Sandi Saat Ini</label>
            <div
              className={`password-recovery-field__control password-recovery-field__control--plain${
                fieldErrors.currentPassword
                  ? " password-recovery-field__control--error"
                  : ""
              }`}
            >
              <input
                autoComplete="current-password"
                id="current-password"
                name="currentPassword"
                onChange={(event) => {
                  const value = event.target.value;
                  setCurrentPassword(value);
                  setFeedback(null);
                  setFieldErrors((current) => ({
                    ...current,
                    currentPassword: value.trim()
                      ? undefined
                      : "Kata sandi saat ini harus diisi.",
                  }));
                }}
                placeholder="Masukkan kata sandi lama"
                type={visibleFields.currentPassword ? "text" : "password"}
                value={currentPassword}
              />
              <button
                aria-label={
                  visibleFields.currentPassword
                    ? "Sembunyikan kata sandi saat ini"
                    : "Tampilkan kata sandi saat ini"
                }
                className="password-recovery-field__toggle"
                onClick={() => toggleField("currentPassword")}
                type="button"
              >
                <img src={eyeIcon} alt="" />
              </button>
            </div>
            {fieldErrors.currentPassword && (
              <p className="password-recovery-field__error">
                {fieldErrors.currentPassword}
              </p>
            )}
          </div>

          <div className="password-recovery-field">
            <label htmlFor="profile-new-password">Kata Sandi Baru</label>
            <div
              className={`password-recovery-field__control password-recovery-field__control--plain${
                fieldErrors.password
                  ? " password-recovery-field__control--error"
                  : ""
              }`}
            >
              <input
                autoComplete="new-password"
                id="profile-new-password"
                name="password"
                onChange={(event) => handlePasswordChange(event.target.value)}
                placeholder="Minimal 8 karakter"
                type={visibleFields.password ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={
                  visibleFields.password
                    ? "Sembunyikan kata sandi baru"
                    : "Tampilkan kata sandi baru"
                }
                className="password-recovery-field__toggle"
                onClick={() => toggleField("password")}
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
            <label htmlFor="profile-new-password-confirmation">
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
                id="profile-new-password-confirmation"
                name="passwordConfirmation"
                onChange={(event) =>
                  handlePasswordConfirmationChange(event.target.value)
                }
                placeholder="Ulangi kata sandi baru"
                type={
                  visibleFields.passwordConfirmation ? "text" : "password"
                }
                value={passwordConfirmation}
              />
              <button
                aria-label={
                  visibleFields.passwordConfirmation
                    ? "Sembunyikan konfirmasi kata sandi"
                    : "Tampilkan konfirmasi kata sandi"
                }
                className="password-recovery-field__toggle"
                onClick={() => toggleField("passwordConfirmation")}
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
            disabled={isSubmitting}
            type="submit"
          >
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi"}</span>
            <img src={submitIcon} alt="" aria-hidden="true" />
          </button>
        </form>

        <div className="password-recovery-back password-recovery-back--profile">
          <button onClick={onBackToProfile} type="button">
            <img src={backIcon} alt="" aria-hidden="true" />
            Kembali ke Profil
          </button>
        </div>
      </section>

      <footer className="password-recovery-footer">
        &copy; 2026 Pemerintah Kota Yogyakarta. All rights reserved.
      </footer>
    </main>
  );
};
