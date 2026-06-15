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
import { API_BASE_URL } from "../../lib/api";
import "../../styles/auth/Register.scss";

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";
const CONTACT_CODE_COOLDOWN_MS = 60_000;

type RegisterProps = {
  onRegisterSuccess?: () => void;
  onSwitchToLogin?: () => void;
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

type RegisterFieldName = keyof RegisterForm | "terms";
type RegisterFieldErrors = Partial<Record<RegisterFieldName, string>>;
type LegalDocument = "privacy" | "terms";

type RegisterFieldAction = {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  text: string;
  variant?: "default" | "success";
};

type RegisterFieldProps = {
  action?: RegisterFieldAction;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  icon?: string;
  id: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  name: keyof RegisterForm;
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

type ContactVerificationState = {
  code: string;
  cooldownUntil: number;
  isOpen: boolean;
  isSending: boolean;
  isVerified: boolean;
  isVerifying: boolean;
  message: string;
  sentValue: string;
  type: "error" | "info" | "success";
};

type ContactVerificationModalProps = {
  code: string;
  description: string;
  inputId: string;
  isOpen: boolean;
  isSending: boolean;
  isVerifying: boolean;
  message: string;
  remainingSeconds: number;
  title: string;
  titleId: string;
  type: "error" | "info" | "success";
  onClose: () => void;
  onCodeChange: (value: string) => void;
  onResend: () => void;
  onVerify: () => void;
};

type LegalInfoModalProps = {
  document: LegalDocument;
  onClose: () => void;
};

type ApiResult = {
  data?: {
    access_token?: string;
    address?: string | null;
    name?: string;
    position?: string;
    token?: string;
  };
  access_token?: string;
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

const initialVerificationState: ContactVerificationState = {
  code: "",
  cooldownUntil: 0,
  isOpen: false,
  isSending: false,
  isVerified: false,
  isVerifying: false,
  message: "",
  sentValue: "",
  type: "info",
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const getToken = (result: ApiResult) =>
  result.token ?? result.access_token ?? result.data?.token ?? result.data?.access_token;

const persistAuthSession = (result: ApiResult) => {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.setItem(AUTH_SESSION_KEY, "1");

  const token = getToken(result);

  if (!token) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    throw new Error("Token registrasi tidak diterima dari server.");
  }

  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
};

const getPositionLabel = (position: string) => {
  const positionLabels: Record<string, string> = {
    asn: "Pegawai ASN",
    non_asn: "Pegawai Non-ASN",
    public: "Warga",
  };

  return positionLabels[position] ?? "";
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateEmail = (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  if (normalizedEmail.length > 255) {
    return "Email maksimal 255 karakter.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Format email tidak valid.";
  }

  return null;
};

const normalizePhone = (phone: string) => {
  const trimmedPhone = phone.trim();

  if (!trimmedPhone) {
    return { phone: "", error: null };
  }

  const compactPhone = trimmedPhone.replace(/[\s().-]/g, "");

  if (!/^\+?[0-9]+$/.test(compactPhone)) {
    return { phone: "", error: "Format nomor telepon tidak valid." };
  }

  let normalizedPhone: string;

  if (compactPhone.startsWith("+62")) {
    normalizedPhone = compactPhone;
  } else if (compactPhone.startsWith("62")) {
    normalizedPhone = `+${compactPhone}`;
  } else if (compactPhone.startsWith("0")) {
    normalizedPhone = `+62${compactPhone.slice(1)}`;
  } else {
    return {
      phone: "",
      error: "Format nomor telepon harus diawali dengan +62, 62, atau 08.",
    };
  }

  if (!/^\+62[0-9]{8,13}$/.test(normalizedPhone)) {
    return { phone: "", error: "Format nomor telepon tidak valid." };
  }

  return { phone: normalizedPhone, error: null };
};

const validateRequiredPhone = (phone: string) => {
  if (!phone.trim()) {
    return "Nomor telepon harus diisi.";
  }

  return normalizePhone(phone).error;
};

const validateRegisterField = (
  field: RegisterFieldName,
  values: RegisterForm,
  acceptedTerms: boolean,
) => {
  const nik = values.nik.trim();
  const username = values.username.trim();

  switch (field) {
    case "nik":
      if (!nik) {
        return "NIK harus diisi.";
      }

      if (!/^\d{16}$/.test(nik)) {
        return "NIK harus 16 digit angka.";
      }

      return null;

    case "fullName":
      return values.fullName.trim() ? null : "Nama lengkap harus diisi.";

    case "username":
      if (!username) {
        return "Username wajib diisi.";
      }

      if (username.length > 25) {
        return "Username maksimal 25 karakter.";
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return "Username hanya boleh berisi huruf, angka, dan underscore.";
      }

      return null;

    case "email":
      return validateEmail(values.email);

    case "phone":
      return normalizePhone(values.phone).error;

    case "password":
      if (!values.password.trim()) {
        return "Password harus diisi.";
      }

      if (values.password.length < 6) {
        return "Password minimal 6 karakter.";
      }

      if (values.password.length > 255) {
        return "Password maksimal 255 karakter.";
      }

      return null;

    case "passwordConfirmation":
      if (!values.passwordConfirmation) {
        return null;
      }

      return values.password === values.passwordConfirmation
        ? null
        : "Konfirmasi kata sandi belum sama.";

    case "position":
      return values.position.trim()
        ? null
        : "Posisi pengguna dari data identitas tidak valid.";

    case "terms":
      return acceptedTerms ? null : "Syarat dan Ketentuan wajib disetujui.";

    case "address":
      return null;

    default:
      return null;
  }
};

const getRemainingSeconds = (cooldownUntil: number, now: number) =>
  Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

const getFieldFromApiMessage = (message: string): RegisterFieldName | null => {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("nik")) {
    return "nik";
  }

  if (normalizedMessage.includes("nama")) {
    return "fullName";
  }

  if (normalizedMessage.includes("username")) {
    return "username";
  }

  if (normalizedMessage.includes("email")) {
    return "email";
  }

  if (normalizedMessage.includes("telepon")) {
    return "phone";
  }

  if (normalizedMessage.includes("password")) {
    return "password";
  }

  if (normalizedMessage.includes("posisi") || normalizedMessage.includes("position")) {
    return "position";
  }

  return null;
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
  action,
  autoComplete,
  disabled = false,
  error,
  icon,
  id,
  label,
  maxLength,
  multiline = false,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: RegisterFieldProps) => {
  const controlClassName = [
    multiline
      ? "register-field__control register-field__control--textarea"
      : "register-field__control",
    error ? "register-field__control--error" : "",
    action ? "register-field__control--with-action" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="register-field">
      <label htmlFor={id}>{label}</label>
      <div className={controlClassName}>
        {icon && !multiline && (
          <span className="register-field__icon" aria-hidden="true">
            <img src={icon} alt="" />
          </span>
        )}
        {multiline ? (
          <textarea
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
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
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
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
        {action && !multiline && (
          <button
            aria-label={action.label}
            className={`register-field__action register-field__action--${
              action.variant ?? "default"
            }`}
            disabled={action.disabled}
            onClick={action.onClick}
            type="button"
          >
            {action.text}
          </button>
        )}
      </div>
      {error && (
        <p className="register-field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

const ContactVerificationModal = ({
  code,
  description,
  inputId,
  isOpen,
  isSending,
  isVerifying,
  message,
  remainingSeconds,
  title,
  titleId,
  type,
  onClose,
  onCodeChange,
  onResend,
  onVerify,
}: ContactVerificationModalProps) => {
  if (!isOpen) {
    return null;
  }

  const isBusy = isSending || isVerifying;

  return (
    <div className="register-modal" role="presentation">
      <button
        aria-label="Tutup popup verifikasi"
        className="register-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="register-modal__panel"
        role="dialog"
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </header>

        <label className="register-modal__field" htmlFor={inputId}>
          <span>Kode Verifikasi</span>
          <input
            autoComplete="one-time-code"
            id={inputId}
            inputMode="numeric"
            maxLength={6}
            onChange={(event) =>
              onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="6 digit kode"
            value={code}
          />
        </label>

        {message && (
          <p className={`register-modal__message register-modal__message--${type}`}>
            {message}
          </p>
        )}

        <div className="register-modal__actions">
          <button
            disabled={isBusy || remainingSeconds > 0}
            onClick={onResend}
            type="button"
          >
            {remainingSeconds > 0 ? `Kirim ulang (${remainingSeconds}s)` : "Kirim ulang"}
          </button>
          <button
            className="register-modal__primary"
            disabled={isBusy || code.length !== 6}
            onClick={onVerify}
            type="button"
          >
            {isVerifying ? "Memeriksa..." : "Verifikasi"}
          </button>
        </div>

        <button className="register-modal__close" onClick={onClose} type="button">
          Tutup
        </button>
      </section>
    </div>
  );
};

const legalDocuments: Record<
  LegalDocument,
  { items: string[]; title: string }
> = {
  privacy: {
    title: "Kebijakan Privasi",
    items: [
      "Data identitas digunakan untuk kebutuhan autentikasi, verifikasi, dan pengelolaan akses survei.",
      "NIK, nama, alamat, email, dan nomor telepon diproses sesuai kebutuhan layanan Survey Jogja.",
      "Data tidak dibagikan kepada pihak lain di luar kebutuhan operasional layanan dan ketentuan hukum yang berlaku.",
      "Pengguna dapat meminta pembaruan atau peninjauan data melalui kanal bantuan resmi.",
    ],
  },
  terms: {
    title: "Syarat dan Ketentuan",
    items: [
      "Pengguna wajib mengisi data yang benar dan dapat dipertanggungjawabkan.",
      "Akun hanya boleh digunakan oleh pemilik identitas yang terverifikasi.",
      "Pengguna bertanggung jawab menjaga kerahasiaan kata sandi dan akses akun.",
      "Penyalahgunaan layanan dapat mengakibatkan pembatasan atau penonaktifan akun.",
    ],
  },
};

const LegalInfoModal = ({ document, onClose }: LegalInfoModalProps) => {
  const content = legalDocuments[document];
  const titleId = `register-${document}-title`;

  return (
    <div className="register-modal" role="presentation">
      <button
        aria-label={`Tutup ${content.title}`}
        className="register-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="register-modal__panel register-modal__panel--legal"
        role="dialog"
      >
        <header>
          <h2 id={titleId}>{content.title}</h2>
        </header>

        <ul className="register-legal-list">
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <button
          className="register-modal__primary register-modal__standalone"
          onClick={onClose}
          type="button"
        >
          Mengerti
        </button>
      </section>
    </div>
  );
};

export const Register = ({
  onRegisterSuccess,
  onSwitchToLogin,
}: RegisterProps) => {
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activeLegalDocument, setActiveLegalDocument] =
    useState<LegalDocument | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [emailVerification, setEmailVerification] =
    useState<ContactVerificationState>(initialVerificationState);
  const [phoneVerification, setPhoneVerification] =
    useState<ContactVerificationState>(initialVerificationState);
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

  const emailRemainingSeconds = getRemainingSeconds(
    emailVerification.cooldownUntil,
    now,
  );
  const phoneRemainingSeconds = getRemainingSeconds(
    phoneVerification.cooldownUntil,
    now,
  );

  useEffect(() => {
    const hasActiveCooldown =
      emailVerification.cooldownUntil > Date.now() ||
      phoneVerification.cooldownUntil > Date.now();

    if (
      !hasActiveCooldown &&
      !emailVerification.isOpen &&
      !phoneVerification.isOpen
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, [
    emailVerification.cooldownUntil,
    emailVerification.isOpen,
    phoneVerification.cooldownUntil,
    phoneVerification.isOpen,
  ]);

  const setFieldError = (field: RegisterFieldName, message: string) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: message,
    }));
  };

  const clearFieldError = (field: RegisterFieldName) => {
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const setOrClearFieldError = (
    field: RegisterFieldName,
    message: string | null,
  ) => {
    setFieldErrors((current) => {
      const nextErrors = { ...current };

      if (message) {
        nextErrors[field] = message;
      } else {
        delete nextErrors[field];
      }

      return nextErrors;
    });
  };

  const resetEmailVerification = () => {
    setEmailVerification(initialVerificationState);
  };

  const resetPhoneVerification = () => {
    setPhoneVerification(initialVerificationState);
  };

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    const fieldName = name as keyof RegisterForm;

    setFeedback(null);

    if (fieldName === "nik") {
      const nextNik = value.trim();
      const nextForm = {
        ...form,
        address: "",
        fullName: "",
        nik: value,
        position: "",
      };

      setForm(nextForm);
      setOrClearFieldError("fullName", null);
      setOrClearFieldError("position", null);

      if (nextNik.length === 0) {
        setNikVerification({ message: "", status: "idle" });
        setOrClearFieldError("nik", validateRegisterField("nik", nextForm, acceptedTerms));
        return;
      }

      if (nextNik.length < 16) {
        setNikVerification({ message: "", status: "idle" });
        setOrClearFieldError("nik", validateRegisterField("nik", nextForm, acceptedTerms));
        return;
      }

      if (!/^\d{16}$/.test(nextNik)) {
        setNikVerification({ message: "", status: "error" });
        setOrClearFieldError("nik", validateRegisterField("nik", nextForm, acceptedTerms));
        return;
      }

      setOrClearFieldError("nik", null);
      setNikVerification({
        message: "Memverifikasi NIK...",
        status: "verifying",
      });
      return;
    }

    if (fieldName === "email") {
      const nextEmail = normalizeEmail(value);

      if (
        emailVerification.sentValue &&
        nextEmail !== emailVerification.sentValue
      ) {
        resetEmailVerification();
      }
    }

    if (fieldName === "phone") {
      const nextPhone = normalizePhone(value).phone;

      if (phoneVerification.sentValue && nextPhone !== phoneVerification.sentValue) {
        resetPhoneVerification();
      }
    }

    const nextForm = {
      ...form,
      [fieldName]: value,
    };

    setForm(nextForm);
    setOrClearFieldError(
      fieldName,
      validateRegisterField(fieldName, nextForm, acceptedTerms),
    );

    if (
      fieldName === "password" &&
      nextForm.passwordConfirmation.trim() !== ""
    ) {
      setOrClearFieldError(
        "passwordConfirmation",
        validateRegisterField("passwordConfirmation", nextForm, acceptedTerms),
      );
    }

    if (fieldName === "passwordConfirmation") {
      setOrClearFieldError(
        "passwordConfirmation",
        validateRegisterField("passwordConfirmation", nextForm, acceptedTerms),
      );
    }
  };

  useEffect(() => {
    const nik = form.nik.trim();

    if (!/^\d{16}$/.test(nik)) {
      return undefined;
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
        clearFieldError("nik");
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
        setNikVerification({ message: "", status: "error" });
        setFieldError(
          "nik",
          error instanceof Error ? error.message : "NIK gagal diverifikasi.",
        );
      }
    };

    const timeoutId = window.setTimeout(verifyNik, 400);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [form.nik]);

  const validateForm = () => {
    const errors: RegisterFieldErrors = {};
    const fields: RegisterFieldName[] = [
      "nik",
      "fullName",
      "username",
      "email",
      "phone",
      "password",
      "passwordConfirmation",
      "position",
      "terms",
    ];

    fields.forEach((field) => {
      const error = validateRegisterField(field, form, acceptedTerms);

      if (error) {
        errors[field] = error;
      }
    });

    if (form.password !== form.passwordConfirmation) {
      errors.passwordConfirmation = "Konfirmasi kata sandi belum sama.";
    }

    if (
      !errors.nik &&
      (nikVerification.status !== "success" || !form.fullName.trim())
    ) {
      errors.nik = "NIK harus terverifikasi sebelum registrasi.";
    }

    return errors;
  };

  const sendEmailCode = async () => {
    const email = normalizeEmail(form.email);
    const emailError = email ? validateEmail(email) : "Email harus diisi.";

    if (emailError) {
      setFieldError("email", emailError);
      return;
    }

    setEmailVerification((current) => ({
      ...current,
      isSending: true,
      message: "Mengirim kode verifikasi email...",
      type: "info",
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/email/code`, {
        body: JSON.stringify({ email }),
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
      setNow(Date.now());
      setEmailVerification((current) => ({
        ...current,
        code: "",
        cooldownUntil: Date.now() + CONTACT_CODE_COOLDOWN_MS,
        isOpen: true,
        isSending: false,
        isVerified: false,
        message: result.message ?? "Kode verifikasi email sudah dikirim.",
        sentValue: email,
        type: "success",
      }));
      clearFieldError("email");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kode verifikasi email gagal dikirim.";
      setEmailVerification((current) => ({
        ...current,
        isOpen: true,
        isSending: false,
        message,
        type: "error",
      }));
      setFieldError("email", message);
    }
  };

  const sendPhoneOtp = async () => {
    const phoneError = validateRequiredPhone(form.phone);
    const normalizedPhone = normalizePhone(form.phone).phone;

    if (phoneError) {
      setFieldError("phone", phoneError);
      return;
    }

    setPhoneVerification((current) => ({
      ...current,
      isSending: true,
      message: "Mengirim OTP nomor telepon...",
      type: "info",
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/phone/otp`, {
        body: JSON.stringify({ phone: form.phone.trim() }),
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
      setNow(Date.now());
      setPhoneVerification((current) => ({
        ...current,
        code: "",
        cooldownUntil: Date.now() + CONTACT_CODE_COOLDOWN_MS,
        isOpen: true,
        isSending: false,
        isVerified: false,
        message: result.message ?? "OTP nomor telepon sudah dikirim.",
        sentValue: normalizedPhone,
        type: "success",
      }));
      clearFieldError("phone");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OTP nomor telepon gagal dikirim.";
      setPhoneVerification((current) => ({
        ...current,
        isOpen: true,
        isSending: false,
        message,
        type: "error",
      }));
      setFieldError("phone", message);
    }
  };

  const handleEmailAction = () => {
    const email = normalizeEmail(form.email);

    if (emailVerification.sentValue === email) {
      setEmailVerification((current) => ({ ...current, isOpen: true }));
      return;
    }

    void sendEmailCode();
  };

  const handlePhoneAction = () => {
    const normalizedPhone = normalizePhone(form.phone).phone;

    if (phoneVerification.sentValue === normalizedPhone) {
      setPhoneVerification((current) => ({ ...current, isOpen: true }));
      return;
    }

    void sendPhoneOtp();
  };

  const verifyEmailCode = async () => {
    setEmailVerification((current) => ({
      ...current,
      isVerifying: true,
      message: "",
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/email/verify`, {
        body: JSON.stringify({
          code: emailVerification.code,
          email: emailVerification.sentValue,
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

      await response.json();
      setEmailVerification((current) => ({
        ...current,
        code: "",
        isOpen: false,
        isVerified: true,
        isVerifying: false,
        message: "",
        type: "success",
      }));
      clearFieldError("email");
    } catch (error) {
      setEmailVerification((current) => ({
        ...current,
        isVerifying: false,
        message:
          error instanceof Error
            ? error.message
            : "Kode verifikasi email tidak valid.",
        type: "error",
      }));
    }
  };

  const verifyPhoneOtp = async () => {
    setPhoneVerification((current) => ({
      ...current,
      isVerifying: true,
      message: "",
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/phone/verify`, {
        body: JSON.stringify({
          code: phoneVerification.code,
          phone: phoneVerification.sentValue,
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

      await response.json();
      setPhoneVerification((current) => ({
        ...current,
        code: "",
        isOpen: false,
        isVerified: true,
        isVerifying: false,
        message: "",
        type: "success",
      }));
      clearFieldError("phone");
    } catch (error) {
      setPhoneVerification((current) => ({
        ...current,
        isVerifying: false,
        message:
          error instanceof Error
            ? error.message
            : "OTP nomor telepon tidak valid.",
        type: "error",
      }));
    }
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
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        body: JSON.stringify({
          address: form.address.trim(),
          email: normalizeEmail(form.email),
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
      persistAuthSession(result);
      onRegisterSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Registrasi gagal. Silakan coba lagi.";
      const field = getFieldFromApiMessage(message);

      if (field) {
        setFieldError(field, message);
      } else {
        setFeedback({
          message,
          type: "error",
        });
      }
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
                error={fieldErrors.nik}
                icon={idIcon}
                id="nik"
                label="NIK"
                maxLength={16}
                name="nik"
                onChange={handleFieldChange}
                placeholder="3471xxxxxxxxxxxx"
                value={form.nik}
              />
              {nikVerification.message && nikVerification.status !== "error" && (
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
                  error={fieldErrors.fullName}
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
                  action={{
                    disabled: emailVerification.isSending || !form.email.trim(),
                    label: "Verifikasi email",
                    onClick: handleEmailAction,
                    text: emailVerification.isVerified ? "Terverifikasi" : "Verif",
                    variant: emailVerification.isVerified ? "success" : "default",
                  }}
                  autoComplete="email"
                  error={fieldErrors.email}
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
                  action={{
                    disabled: phoneVerification.isSending || !form.phone.trim(),
                    label: "Kirim OTP nomor telepon",
                    onClick: handlePhoneAction,
                    text: phoneVerification.isVerified ? "Terverifikasi" : "OTP",
                    variant: phoneVerification.isVerified ? "success" : "default",
                  }}
                  autoComplete="tel"
                  error={fieldErrors.phone}
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
                  error={fieldErrors.address}
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
                  error={fieldErrors.position}
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
                error={fieldErrors.username}
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
                  error={fieldErrors.password}
                  icon={passwordIcon}
                  id="password"
                  label="Kata Sandi"
                  name="password"
                  onChange={handleFieldChange}
                  placeholder="Minimal 6 karakter"
                  type="password"
                  value={form.password}
                />
                <RegisterField
                  autoComplete="new-password"
                  error={fieldErrors.passwordConfirmation}
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
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    setOrClearFieldError(
                      "terms",
                      validateRegisterField("terms", form, event.target.checked),
                    );
                  }}
                  type="checkbox"
                />
                <span>
                  Saya menyetujui{" "}
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveLegalDocument("terms");
                    }}
                    type="button"
                  >
                    Syarat dan Ketentuan
                  </button>{" "}
                  serta{" "}
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveLegalDocument("privacy");
                    }}
                    type="button"
                  >
                    Kebijakan Privasi
                  </button>{" "}
                  yang berlaku di ekosistem Survey Jogja.
                </span>
              </label>

              {fieldErrors.terms && (
                <p className="register-field__error">{fieldErrors.terms}</p>
              )}

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

      <ContactVerificationModal
        code={emailVerification.code}
        description="Masukkan 6 digit kode yang dikirim ke email Anda."
        inputId="email-verification-code"
        isOpen={emailVerification.isOpen}
        isSending={emailVerification.isSending}
        isVerifying={emailVerification.isVerifying}
        message={emailVerification.message}
        onClose={() =>
          setEmailVerification((current) => ({ ...current, isOpen: false }))
        }
        onCodeChange={(code) =>
          setEmailVerification((current) => ({ ...current, code }))
        }
        onResend={() => void sendEmailCode()}
        onVerify={() => void verifyEmailCode()}
        remainingSeconds={emailRemainingSeconds}
        title="Verifikasi Email"
        titleId="email-verification-title"
        type={emailVerification.type}
      />

      <ContactVerificationModal
        code={phoneVerification.code}
        description="Masukkan 6 digit OTP yang dikirim ke nomor telepon Anda."
        inputId="phone-verification-code"
        isOpen={phoneVerification.isOpen}
        isSending={phoneVerification.isSending}
        isVerifying={phoneVerification.isVerifying}
        message={phoneVerification.message}
        onClose={() =>
          setPhoneVerification((current) => ({ ...current, isOpen: false }))
        }
        onCodeChange={(code) =>
          setPhoneVerification((current) => ({ ...current, code }))
        }
        onResend={() => void sendPhoneOtp()}
        onVerify={() => void verifyPhoneOtp()}
        remainingSeconds={phoneRemainingSeconds}
        title="Verifikasi Nomor Telepon"
        titleId="phone-verification-title"
        type={phoneVerification.type}
      />

      {activeLegalDocument && (
        <LegalInfoModal
          document={activeLegalDocument}
          onClose={() => setActiveLegalDocument(null)}
        />
      )}
    </main>
  );
};
