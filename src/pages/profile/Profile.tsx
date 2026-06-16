import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import badgeCheckIcon from "../../assets/profile/profile-badge-check.svg";
import breadcrumbChevronIcon from "../../assets/profile/profile-breadcrumb-chevron.svg";
import cameraIcon from "../../assets/profile/profile-camera.svg";
import chevronRightIcon from "../../assets/profile/profile-chevron-right.svg";
import editIcon from "../../assets/profile/profile-edit.svg";
import lockIcon from "../../assets/profile/profile-lock.svg";
import profileAvatar from "../../assets/profile/profile-avatar.jpg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/profile/Profile.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";
const CONTACT_CODE_COOLDOWN_MS = 60_000;

type ProfileProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenChangePassword?: () => void;
  onOpenManageSurveys?: () => void;
  onOpenSurveyList?: () => void;
  onProfileLoaded?: (profile: AccountProfile) => void;
  onUnauthorized?: () => void;
};

type AccountProfile = {
  full_name?: string | null;
  username?: string | null;
};

type ProfileData = {
  address: string | null;
  email: string | null;
  email_verified?: boolean;
  email_verified_at?: string | null;
  full_name: string;
  id: number;
  is_active: boolean;
  nik: string;
  phone: string | null;
  phone_verified?: boolean;
  phone_verified_at?: string | null;
  position: "asn" | "non_asn" | "public" | string;
  role: string;
  role_id: number;
  username: string;
};

type ApiResult<T> = {
  data?: T;
  message?: string;
};

type EditableProfileField = "email" | "phone" | "username";
type ContactChannel = "email" | "phone";

type ProfileField = {
  editable?: EditableProfileField;
  isVerified?: boolean;
  key: string;
  label: string;
  value: string;
  verification?: ContactChannel;
  warning?: string;
};

type ContactVerificationState = {
  channel: ContactChannel | null;
  code: string;
  cooldownUntil: number;
  isOpen: boolean;
  isSending: boolean;
  isVerifying: boolean;
  message: string;
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

const POSITION_LABELS: Record<string, string> = {
  asn: "Pegawai ASN",
  non_asn: "Pegawai Non-ASN",
  public: "Warga",
};

const ROLE_LABELS: Record<string, string> = {
  admin_opd: "Admin OPD",
  superadmin: "SuperAdmin",
  user: "User",
};

const initialContactVerification: ContactVerificationState = {
  channel: null,
  code: "",
  cooldownUntil: 0,
  isOpen: false,
  isSending: false,
  isVerifying: false,
  message: "",
  type: "info",
};

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (withJson = false): HeadersInit => {
  const token = getStoredToken();
  const headers: Record<string, string> = {};

  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult<unknown>;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const displayValue = (value: string | null | undefined) => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  return trimmedValue || "-";
};

const formatRole = (role: string) => {
  if (ROLE_LABELS[role]) {
    return ROLE_LABELS[role];
  }

  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatPosition = (position: string) =>
  POSITION_LABELS[position] ?? "Warga";

const validateEditableField = (
  field: EditableProfileField,
  value: string,
) => {
  const trimmedValue = value.trim();

  if (field === "username") {
    if (!trimmedValue) {
      return "Username harus diisi.";
    }

    if (trimmedValue.length > 25) {
      return "Username maksimal 25 karakter.";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedValue)) {
      return "Username hanya boleh huruf, angka, dan underscore.";
    }

    return null;
  }

  if (trimmedValue === "") {
    return null;
  }

  if (field === "email") {
    if (trimmedValue.length > 255) {
      return "Email maksimal 255 karakter.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
      return "Format email tidak valid.";
    }

    return null;
  }

  const normalizedPhone = trimmedValue.replace(/[\s().-]/g, "");

  if (!/^\+?[0-9]+$/.test(normalizedPhone)) {
    return "Format nomor telepon tidak valid.";
  }

  const isIndonesianPhone =
    normalizedPhone.startsWith("+62") ||
    normalizedPhone.startsWith("62") ||
    normalizedPhone.startsWith("08");

  if (!isIndonesianPhone) {
    return "Nomor telepon harus diawali +62, 62, atau 08.";
  }

  const comparablePhone = normalizedPhone.startsWith("08")
    ? `+62${normalizedPhone.slice(1)}`
    : normalizedPhone.startsWith("62")
      ? `+${normalizedPhone}`
      : normalizedPhone;

  if (!/^\+62[0-9]{8,13}$/.test(comparablePhone)) {
    return "Format nomor telepon tidak valid.";
  }

  return null;
};

const getEditableFieldAutoComplete = (field: EditableProfileField) => {
  if (field === "username") {
    return "username";
  }

  return field === "email" ? "email" : "tel";
};

const getEditableFieldInputMode = (field: EditableProfileField) => {
  if (field === "username") {
    return "text";
  }

  return field === "email" ? "email" : "tel";
};

const getEditableFieldType = (field: EditableProfileField) => {
  if (field === "username") {
    return "text";
  }

  return field === "email" ? "email" : "tel";
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
    <div className="profile-modal" role="presentation">
      <button
        aria-label="Tutup popup verifikasi"
        className="profile-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="profile-modal__panel"
        role="dialog"
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </header>

        <label className="profile-modal__field" htmlFor={inputId}>
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
          <p className={`profile-modal__message profile-modal__message--${type}`}>
            {message}
          </p>
        )}

        <div className="profile-modal__actions">
          <button
            disabled={isBusy || remainingSeconds > 0}
            onClick={onResend}
            type="button"
          >
            {remainingSeconds > 0
              ? `Kirim ulang (${remainingSeconds}s)`
              : "Kirim ulang"}
          </button>
          <button
            className="profile-modal__primary"
            disabled={isBusy || code.length !== 6}
            onClick={onVerify}
            type="button"
          >
            {isVerifying ? "Memeriksa..." : "Verifikasi"}
          </button>
        </div>

        <button className="profile-modal__close" onClick={onClose} type="button">
          Tutup
        </button>
      </section>
    </div>
  );
};

export const Profile = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenChangePassword,
  onOpenManageSurveys,
  onOpenSurveyList,
  onProfileLoaded,
  onUnauthorized,
}: ProfileProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [editingField, setEditingField] =
    useState<EditableProfileField | null>(null);
  const [drafts, setDrafts] = useState<Record<EditableProfileField, string>>({
    email: "",
    phone: "",
    username: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<EditableProfileField, string>>
  >({});
  const [savingField, setSavingField] = useState<EditableProfileField | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [contactVerification, setContactVerification] =
    useState<ContactVerificationState>(initialContactVerification);

  const applyProfile = useCallback(
    (nextProfile: ProfileData) => {
      setProfile(nextProfile);
      setDrafts({
        email: nextProfile.email ?? "",
        phone: nextProfile.phone ?? "",
        username: nextProfile.username ?? "",
      });
      onProfileLoaded?.(nextProfile);
    },
    [onProfileLoaded],
  );

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        credentials: "include",
        headers: authHeaders(),
        method: "GET",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult<ProfileData>;

      if (!result.data) {
        throw new Error("Data profil tidak ditemukan.");
      }

      applyProfile(result.data);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Profil gagal dimuat. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  }, [applyProfile, isAuthenticated, onUnauthorized]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadProfile]);

  useEffect(() => {
    if (!contactVerification.isOpen || contactVerification.cooldownUntil <= now) {
      return;
    }

    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [contactVerification.cooldownUntil, contactVerification.isOpen, now]);

  const profileFields = useMemo<ProfileField[]>(
    () => [
      {
        key: "full_name",
        label: "Nama Lengkap",
        value: displayValue(profile?.full_name),
      },
      {
        key: "nik",
        label: "NIK",
        value: displayValue(profile?.nik),
      },
      {
        key: "address",
        label: "Alamat Lengkap",
        value: displayValue(profile?.address),
      },
      {
        editable: "username",
        key: "username",
        label: "Username",
        value: displayValue(profile?.username),
      },
      {
        editable: "email",
        isVerified: Boolean(profile?.email_verified),
        key: "email",
        label: "Alamat Email",
        value: displayValue(profile?.email),
        verification: "email",
        warning:
          profile?.email && !profile.email_verified
            ? "Email belum terverifikasi. Verifikasi agar email bisa dipakai untuk reset password."
            : undefined,
      },
      {
        editable: "phone",
        isVerified: Boolean(profile?.phone_verified),
        key: "phone",
        label: "Nomor Telepon",
        value: displayValue(profile?.phone),
        verification: "phone",
        warning:
          profile?.phone && !profile.phone_verified
            ? "Nomor telepon belum terverifikasi."
            : undefined,
      },
    ],
    [profile],
  );

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const handleBackHome = () => {
    closeSidebar();
    onBackHome?.();
  };

  const handleNavigationClick = (label: string) => {
    closeSidebar();

    if (label === "Dashboard") {
      onBackHome?.();
    }

    if (label === "Daftar Survey") {
      onOpenSurveyList?.();
    }

    if (label === "Kelola Survey") {
      onOpenManageSurveys?.();
    }
  };

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  const handleStartEdit = (field: EditableProfileField) => {
    setFeedback(null);
    setEditingField(field);
    setDrafts((current) => ({
      ...current,
      [field]: profile?.[field] ?? "",
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setFieldErrors({});
    setDrafts({
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      username: profile?.username ?? "",
    });
  };

  const handleDraftChange = (field: EditableProfileField, value: string) => {
    setDrafts((current) => ({
      ...current,
      [field]: value,
    }));
    setFeedback(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: validateEditableField(field, value) ?? undefined,
    }));
  };

  const handleSaveField = async (
    event: FormEvent<HTMLFormElement>,
    field: EditableProfileField,
  ) => {
    event.preventDefault();

    const error = validateEditableField(field, drafts[field]);

    if (error) {
      setFieldErrors((current) => ({
        ...current,
        [field]: error,
      }));
      return;
    }

    setSavingField(field);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        body: JSON.stringify({
          [field]: drafts[field].trim(),
        }),
        credentials: "include",
        headers: authHeaders(true),
        method: "PATCH",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult<ProfileData>;

      if (result.data) {
        applyProfile(result.data);
      }

      setEditingField(null);
      setFieldErrors({});
      setContactVerification(initialContactVerification);
      setFeedback({
        message: result.message ?? "Profil berhasil diperbarui.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Profil gagal diperbarui. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setSavingField(null);
    }
  };

  const sendContactVerification = async (channel: ContactChannel) => {
    const endpoint =
      channel === "email"
        ? `${API_BASE_URL}/users/profile/email/code`
        : `${API_BASE_URL}/users/profile/phone/otp`;

    setContactVerification((current) => ({
      ...current,
      channel,
      isOpen: true,
      isSending: true,
      message:
        channel === "email"
          ? "Mengirim kode verifikasi email..."
          : "Mengirim OTP nomor telepon...",
      type: "info",
    }));

    try {
      const response = await fetch(endpoint, {
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

      const result = (await response.json()) as ApiResult<unknown>;
      setNow(Date.now());
      setContactVerification((current) => ({
        ...current,
        channel,
        code: "",
        cooldownUntil: Date.now() + CONTACT_CODE_COOLDOWN_MS,
        isOpen: true,
        isSending: false,
        message:
          result.message ??
          (channel === "email"
            ? "Kode verifikasi email sudah dikirim."
            : "OTP nomor telepon sudah dikirim."),
        type: "success",
      }));
    } catch (error) {
      setContactVerification((current) => ({
        ...current,
        channel,
        isOpen: true,
        isSending: false,
        message:
          error instanceof Error
            ? error.message
            : channel === "email"
              ? "Kode verifikasi email gagal dikirim."
              : "OTP nomor telepon gagal dikirim.",
        type: "error",
      }));
    }
  };

  const verifyContact = async () => {
    const channel = contactVerification.channel;

    if (!channel) {
      return;
    }

    const endpoint =
      channel === "email"
        ? `${API_BASE_URL}/users/profile/email/verify`
        : `${API_BASE_URL}/users/profile/phone/verify`;

    setContactVerification((current) => ({
      ...current,
      isVerifying: true,
      message: "",
    }));

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          code: contactVerification.code,
        }),
        credentials: "include",
        headers: authHeaders(true),
        method: "POST",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult<ProfileData>;

      if (result.data) {
        applyProfile(result.data);
      }

      setContactVerification(initialContactVerification);
      setFeedback({
        message:
          result.message ??
          (channel === "email"
            ? "Email berhasil diverifikasi."
            : "Nomor telepon berhasil diverifikasi."),
        type: "success",
      });
    } catch (error) {
      setContactVerification((current) => ({
        ...current,
        isVerifying: false,
        message:
          error instanceof Error
            ? error.message
            : "Kode verifikasi tidak valid.",
        type: "error",
      }));
    }
  };

  const handleVerificationAction = (channel: ContactChannel) => {
    if (contactVerification.channel === channel && contactVerification.isOpen) {
      return;
    }

    void sendContactVerification(channel);
  };

  const handleOpenChangePassword = () => {
    closeSidebar();
    onOpenChangePassword?.();
  };

  const identityName = displayValue(profile?.full_name);
  const positionLabel = formatPosition(profile?.position ?? "");
  const roleLabel = formatRole(profile?.role ?? "user");
  const sidebarName = profile?.full_name?.trim() || accountName || "Pengguna";
  const sidebarDescription =
    profile?.username?.trim() || accountDescription || "Belum login";
  const activeChannel = contactVerification.channel ?? "email";
  const remainingSeconds = Math.max(
    0,
    Math.ceil((contactVerification.cooldownUntil - now) / 1000),
  );

  return (
    <main className="profile-page">
      <Topbar
        avatarSrc={profileAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={closeSidebar}
        onToggleSidebar={toggleSidebar}
        sidebarId="profile-sidebar"
      />

      <Sidebar
        accountDescription={sidebarDescription}
        accountName={sidebarName}
        avatarSrc={profileAvatar}
        id="profile-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="profile-shell">
        <div className="profile-content">
          <div className="profile-main-stack">
            <header className="profile-heading">
              <div>
                <h1>User Profile</h1>
                <p>
                  Manage your personal information, privacy settings, and account
                  security.
                </p>
              </div>

              <nav className="profile-breadcrumb" aria-label="Breadcrumb">
                <button onClick={handleBackHome} type="button">
                  Home
                </button>
                <img src={breadcrumbChevronIcon} alt="" aria-hidden="true" />
                <span>Pengaturan Profil</span>
              </nav>
            </header>

            {feedback && (
              <p className={`profile-feedback profile-feedback--${feedback.type}`}>
                {feedback.message}
              </p>
            )}

            <section className="profile-card profile-overview">
              <div className="profile-overview__inner">
                <div className="profile-overview__avatar-wrap">
                  <img
                    className="profile-overview__avatar"
                    src={profileAvatar}
                    alt=""
                    aria-hidden="true"
                  />
                  <button
                    aria-label="Ubah foto profil"
                    className="profile-overview__camera"
                    type="button"
                  >
                    <img src={cameraIcon} alt="" aria-hidden="true" />
                  </button>
                </div>

                <div className="profile-overview__identity">
                  <h2>{isLoadingProfile ? "Memuat profil..." : identityName}</h2>
                  <div className="profile-badges" aria-label="Status akun">
                    <span className="profile-badge profile-badge--citizen">
                      <img src={badgeCheckIcon} alt="" aria-hidden="true" />
                      {positionLabel}
                    </span>
                    <span className="profile-badge profile-badge--role">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-card profile-info">
              <header>
                <h2>Informasi Pribadi</h2>
              </header>

              {isLoadingProfile ? (
                <p className="profile-empty-state">Memuat data profil...</p>
              ) : (
                <div className="profile-info__grid">
                  {profileFields.map((field) => (
                    <div className="profile-field" key={field.key}>
                      <span>{field.label}</span>
                      {field.editable !== undefined &&
                      editingField === field.editable ? (
                        <form
                          className="profile-field__editor"
                          onSubmit={(event) =>
                            handleSaveField(event, field.editable!)
                          }
                        >
                          <input
                            aria-label={field.label}
                            autoComplete={getEditableFieldAutoComplete(
                              field.editable,
                            )}
                            inputMode={getEditableFieldInputMode(field.editable)}
                            onChange={(event) =>
                              handleDraftChange(field.editable!, event.target.value)
                            }
                            type={getEditableFieldType(field.editable)}
                            value={drafts[field.editable]}
                          />
                          <div className="profile-field__actions">
                            <button
                              disabled={savingField === field.editable}
                              type="submit"
                            >
                              {savingField === field.editable
                                ? "Menyimpan..."
                                : "Simpan"}
                            </button>
                            <button
                              disabled={savingField === field.editable}
                              onClick={handleCancelEdit}
                              type="button"
                            >
                              Batal
                            </button>
                          </div>
                          {fieldErrors[field.editable] && (
                            <p className="profile-field__error">
                              {fieldErrors[field.editable]}
                            </p>
                          )}
                          {field.warning && (
                            <p className="profile-field__warning">{field.warning}</p>
                          )}
                        </form>
                      ) : (
                        <>
                          <div className="profile-field__value">
                            <p>{field.value}</p>
                            {(field.verification || field.editable) && (
                              <div className="profile-field__controls">
                                {field.verification && field.value !== "-" && (
                                  field.isVerified ? (
                                    <span className="profile-field__verified">
                                      Terverifikasi
                                    </span>
                                  ) : (
                                    <button
                                      aria-label={
                                        field.verification === "email"
                                          ? "Verifikasi email"
                                          : "Verifikasi nomor telepon"
                                      }
                                      className="profile-field__verify"
                                      onClick={() =>
                                        handleVerificationAction(
                                          field.verification as ContactChannel,
                                        )
                                      }
                                      type="button"
                                    >
                                      {field.verification === "email"
                                        ? "Verif"
                                        : "OTP"}
                                    </button>
                                  )
                                )}
                                {field.editable && (
                                  <button
                                    aria-label={`Ubah ${field.label}`}
                                    onClick={() => handleStartEdit(field.editable!)}
                                    type="button"
                                  >
                                    <img src={editIcon} alt="" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          {field.warning && (
                            <p className="profile-field__warning">{field.warning}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-card profile-security">
              <h2>Keamanan Akun</h2>
              <button
                className="profile-security__row"
                onClick={handleOpenChangePassword}
                type="button"
              >
                <span className="profile-security__icon" aria-hidden="true">
                  <img src={lockIcon} alt="" />
                </span>
                <span className="profile-security__copy">
                  <strong>Ubah Password</strong>
                  <small>Gunakan password lama untuk membuat password baru</small>
                </span>
                <img
                  className="profile-security__chevron"
                  src={chevronRightIcon}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </section>
          </div>

          <footer className="profile-footer">
            <p>&copy; 2026 Pemerintah Kota Yogyakarta. Hak Cipta Dilindungi.</p>
            <div>
              <span>Kebijakan Privasi</span>
              <span>Syarat & Ketentuan</span>
              <span>Kontak</span>
            </div>
          </footer>
        </div>
      </section>

      <ContactVerificationModal
        code={contactVerification.code}
        description={
          activeChannel === "email"
            ? "Masukkan 6 digit kode yang dikirim ke email akun Anda."
            : "Masukkan 6 digit OTP yang dikirim ke nomor telepon akun Anda."
        }
        inputId={`${activeChannel}-profile-verification-code`}
        isOpen={contactVerification.isOpen}
        isSending={contactVerification.isSending}
        isVerifying={contactVerification.isVerifying}
        message={contactVerification.message}
        onClose={() =>
          setContactVerification((current) => ({ ...current, isOpen: false }))
        }
        onCodeChange={(value) =>
          setContactVerification((current) => ({
            ...current,
            code: value,
            message: "",
          }))
        }
        onResend={() => void sendContactVerification(activeChannel)}
        onVerify={() => void verifyContact()}
        remainingSeconds={remainingSeconds}
        title={
          activeChannel === "email"
            ? "Verifikasi Email"
            : "Verifikasi Nomor Telepon"
        }
        titleId={`${activeChannel}-profile-verification-title`}
        type={contactVerification.type}
      />
    </main>
  );
};
