import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import accountIcon from "../../assets/auth/register/register-account-icon.svg";
import confirmPasswordIcon from "../../assets/auth/register/register-confirm-password-icon.svg";
import dataIcon from "../../assets/auth/register/register-data-icon.svg";
import emailIcon from "../../assets/auth/register/register-email-icon.svg";
import idIcon from "../../assets/auth/register/register-id-icon.svg";
import passwordIcon from "../../assets/auth/register/register-password-icon.svg";
import phoneIcon from "../../assets/auth/register/register-phone-icon.svg";
import submitIcon from "../../assets/auth/register/register-submit-icon.svg";
import userIcon from "../../assets/auth/register/register-user-icon.svg";
import "../../styles/auth/Register.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

type RegisterProps = {
  onSwitchToLogin?: () => void;
};

type RegisterFieldProps = {
  autoComplete?: string;
  icon?: string;
  id: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  name: keyof RegisterForm;
  disabled?: boolean;
  placeholder: string;
  type?: "email" | "password" | "tel" | "text";
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

type RegisterSectionProps = {
  children: ReactNode;
  icon: string;
  title: string;
};

type RegisterForm = {
  address: string;
  email: string;
  fullName: string;
  nik: string;
  password: string;
  passwordConfirmation: string;
  phone: string;
  position: string;
  username: string;
};

type ApiResult = {
  data?: {
    address?: string | null;
    name?: string;
    position?: string;
    token?: string;
  };
  message?: string;
  token?: string;
};

const initialForm: RegisterForm = {
  address: "",
  email: "",
  fullName: "",
  nik: "",
  password: "",
  passwordConfirmation: "",
  phone: "",
  position: "",
  username: "",
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const getToken = (result: ApiResult) => result.token ?? result.data?.token;

const getPositionLabel = (position: string) => {
  const positionLabels: Record<string, string> = {
    asn: "Pegawai ASN",
    non_asn: "Pegawai Non-ASN",
    public: "Warga",
  };

  return positionLabels[position] ?? "";
};

const RegisterSection = ({ children, icon, title }: RegisterSectionProps) => {
  const titleId = `${title.toLowerCase().replace(/\s+/g, "-")}-section`;

  return (
    <section className="register-card" aria-labelledby={titleId}>
      <div className="register-card__header">
        <span className="register-card__icon" aria-hidden="true">
          <img src={icon} alt="" />
        </span>
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="register-card__body">{children}</div>
    </section>
  );
};

const RegisterField = ({
  autoComplete,
  icon,
  id,
  label,
  maxLength,
  multiline = false,
  name,
  onChange,
  disabled = false,
  placeholder,
  type = "text",
  value,
}: RegisterFieldProps) => {
  return (
    <div className="register-field">
      <label htmlFor={id}>{label}</label>
      <div
        className={
          multiline
            ? "register-field__control register-field__control--textarea"
            : "register-field__control"
        }
      >
        {icon && !multiline && (
          <span className="register-field__icon" aria-hidden="true">
            <img src={icon} alt="" />
          </span>
        )}
        {multiline ? (
          <textarea
            autoComplete={autoComplete}
            disabled={disabled}
            id={id}
            name={name}
            onChange={onChange}
            placeholder={placeholder}
            rows={4}
            value={value}
          />
        ) : (
          <input
            autoComplete={autoComplete}
            disabled={disabled}
            id={id}
            maxLength={maxLength}
            name={name}
            onChange={onChange}
            placeholder={placeholder}
            type={type}
            value={value}
          />
        )}
      </div>
    </div>
  );
};

export const Register = ({ onSwitchToLogin }: RegisterProps) => {
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nikVerification, setNikVerification] = useState<{
    message: string;
    status: "idle" | "error" | "success" | "verifying";
  }>({
    message: "",
    status: "idle",
  });
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    const fieldName = name as keyof RegisterForm;

    if (fieldName === "nik") {
      const nextNik = value.trim();

      setForm((current) => ({
        ...current,
        address: "",
        fullName: "",
        nik: value,
        position: "",
      }));

      if (nextNik.length === 0) {
        setNikVerification({ message: "", status: "idle" });
        return;
      }

      if (nextNik.length < 16) {
        setNikVerification({
          message: "Masukkan 16 digit NIK untuk verifikasi otomatis.",
          status: "idle",
        });
        return;
      }

      if (!/^\d{16}$/.test(nextNik)) {
        setNikVerification({
          message: "NIK harus berisi 16 digit angka.",
          status: "error",
        });
        return;
      }

      setNikVerification({
        message: "Memverifikasi NIK...",
        status: "verifying",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      [fieldName]: value,
    }));
  };

  useEffect(() => {
    const nik = form.nik.trim();

    if (!/^\d{16}$/.test(nik)) {
      return;
    }

    const controller = new AbortController();

    const verifyNik = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/verify/${encodeURIComponent(nik)}`,
          {
            credentials: "include",
            method: "GET",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(await getApiMessage(response));
        }

        const result = (await response.json()) as ApiResult;
        const identity = result.data;

        if (!identity?.name || !identity.position) {
          throw new Error("Data identitas tidak lengkap.");
        }

        setForm((current) => ({
          ...current,
          address: identity.address ?? "",
          fullName: identity.name ?? "",
          position: identity.position ?? "",
        }));
        setNikVerification({
          message: "NIK terverifikasi. Data identitas berhasil diambil.",
          status: "success",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setForm((current) => ({
          ...current,
          address: "",
          fullName: "",
          position: "",
        }));
        setNikVerification({
          message:
            error instanceof Error
              ? error.message
              : "NIK gagal diverifikasi.",
          status: "error",
        });
      }
    };

    const timeoutId = window.setTimeout(verifyNik, 400);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [form.nik]);

  const validateForm = () => {
    const nik = form.nik.trim();
    const username = form.username.trim();

    if (!/^\d{16}$/.test(nik)) {
      return "NIK harus berisi 16 digit angka.";
    }

    if (!username) {
      return "Username wajib diisi.";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return "Username hanya boleh berisi huruf, angka, dan underscore.";
    }

    if (username.length > 25) {
      return "Username maksimal 25 karakter.";
    }

    if (form.password.length < 8) {
      return "Kata sandi minimal 8 karakter.";
    }

    if (form.password !== form.passwordConfirmation) {
      return "Konfirmasi kata sandi belum sama.";
    }

    if (nikVerification.status !== "success" || !form.fullName.trim()) {
      return "NIK harus terverifikasi sebelum registrasi.";
    }

    if (!form.position.trim()) {
      return "Posisi pengguna dari data identitas tidak valid.";
    }

    if (!acceptedTerms) {
      return "Syarat dan Ketentuan wajib disetujui.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const validationMessage = validateForm();

    if (validationMessage) {
      setFeedback({
        message: validationMessage,
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        body: JSON.stringify({
          address: form.address.trim(),
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          nik: form.nik.trim(),
          password: form.password,
          phone: form.phone.trim(),
          username: form.username.trim().toLowerCase(),
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
      const token = getToken(result);

      if (token) {
        sessionStorage.setItem("survey_auth_token", token);
      }

      setFeedback({
        message: result.message ?? "Registrasi berhasil.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Registrasi gagal. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="halaman-register">
      <aside className="register-branding" aria-label="Survey PemKot Jogja">
        <div className="register-branding__content">
          <div className="register-branding__logo">
            <span className="register-branding__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>Survey PemKot Jogja</strong>
          </div>
          <div>
            <h1>Mari Berpartisipasi.</h1>
            <p>
              Suara Anda adalah fondasi pembangunan daerah. Daftar sekarang
              untuk mulai memberikan masukan pada berbagai inisiatif pemerintah
              kota.
            </p>
          </div>
        </div>
        <blockquote>
          "Platform resmi untuk survei publik dan jajak pendapat terpadu Daerah
          Istimewa Yogyakarta."
        </blockquote>
      </aside>

      <section className="register-form-section" aria-labelledby="register-title">
        <div className="register-form-section__inner">
          <header className="register-header">
            <h1 id="register-title">Buat Akun Baru</h1>
            <p>Lengkapi data di bawah ini untuk mengakses layanan survei.</p>
          </header>

          <form className="register-form" onSubmit={handleSubmit}>
            <RegisterSection icon={dataIcon} title="DATA DIRI">
              <RegisterField
                autoComplete="off"
                icon={idIcon}
                id="nik"
                label="NIK"
                maxLength={16}
                name="nik"
                onChange={handleFieldChange}
                placeholder="3471xxxxxxxxxxxx"
                value={form.nik}
              />
              {nikVerification.message && (
                <p
                  className={`register-nik-status register-nik-status--${nikVerification.status}`}
                >
                  {nikVerification.message}
                </p>
              )}
              {nikVerification.status === "success" && (
                <RegisterField
                  autoComplete="name"
                  disabled
                  icon={userIcon}
                  id="full-name"
                  label="Nama Lengkap"
                  name="fullName"
                  onChange={handleFieldChange}
                  placeholder="Eko Prasetyo"
                  value={form.fullName}
                />
              )}
              <div className="register-field-grid">
                <RegisterField
                  autoComplete="email"
                  icon={emailIcon}
                  id="email"
                  label="Email"
                  name="email"
                  onChange={handleFieldChange}
                  placeholder="nama@email.com"
                  type="email"
                  value={form.email}
                />
                <RegisterField
                  autoComplete="tel"
                  icon={phoneIcon}
                  id="phone"
                  label="Nomor Telepon"
                  name="phone"
                  onChange={handleFieldChange}
                  placeholder="08xxxxxxxxxx"
                  type="tel"
                  value={form.phone}
                />
              </div>
              {nikVerification.status === "success" && (
                <RegisterField
                  autoComplete="street-address"
                  disabled
                  id="address"
                  label="Alamat Lengkap"
                  multiline
                  name="address"
                  onChange={handleFieldChange}
                  placeholder="Jl. Malioboro No. 1, Kota Yogyakarta"
                  value={form.address}
                />
              )}
              {nikVerification.status === "success" && (
                <RegisterField
                  autoComplete="off"
                  disabled
                  icon={accountIcon}
                  id="position"
                  label="Posisi"
                  name="position"
                  onChange={handleFieldChange}
                  placeholder="Status pengguna"
                  value={getPositionLabel(form.position)}
                />
              )}
            </RegisterSection>

            <RegisterSection icon={accountIcon} title="INFORMASI AKUN">
              <RegisterField
                autoComplete="username"
                icon={idIcon}
                id="username"
                label="Username"
                maxLength={25}
                name="username"
                onChange={handleFieldChange}
                placeholder="Masukkan username"
                value={form.username}
              />
              <div className="register-field-grid">
                <RegisterField
                  autoComplete="new-password"
                  icon={passwordIcon}
                  id="password"
                  label="Kata Sandi"
                  name="password"
                  onChange={handleFieldChange}
                  placeholder="Minimal 8 karakter"
                  type="password"
                  value={form.password}
                />
                <RegisterField
                  autoComplete="new-password"
                  icon={confirmPasswordIcon}
                  id="password-confirmation"
                  label="Konfirmasi Kata Sandi"
                  name="passwordConfirmation"
                  onChange={handleFieldChange}
                  placeholder="Ulangi kata sandi"
                  type="password"
                  value={form.passwordConfirmation}
                />
              </div>
            </RegisterSection>

            <div className="register-actions">
              <label className="register-terms" htmlFor="terms">
                <input
                  checked={acceptedTerms}
                  id="terms"
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Saya menyetujui <button type="button">Syarat dan Ketentuan</button>{" "}
                  serta <button type="button">Kebijakan Privasi</button> yang
                  berlaku di ekosistem Survey Jogja.
                </span>
              </label>

              {feedback && (
                <p className={`register-feedback register-feedback--${feedback.type}`}>
                  {feedback.message}
                </p>
              )}

              <button
                className="register-submit"
                disabled={isSubmitting || nikVerification.status === "verifying"}
                type="submit"
              >
                <span>{isSubmitting ? "Memproses..." : "Daftar"}</span>
                <img src={submitIcon} alt="" aria-hidden="true" />
              </button>

              <p className="register-login-link">
                Sudah punya akun?{" "}
                <button onClick={onSwitchToLogin} type="button">
                  Masuk di sini
                </button>
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};
