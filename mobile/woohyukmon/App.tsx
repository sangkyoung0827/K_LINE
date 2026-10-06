import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getLocales } from "expo-localization";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Clipboard from "expo-clipboard";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Home,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react-native";
import {
  api,
  ApiError,
  forgetSession,
  login,
  restoreSession,
  upload,
} from "./src/api";

type User = { id: string; name: string; readOnly: boolean };
type Question = {
  id: string;
  title: string;
  type: "text" | "paragraph" | "single" | "multiple";
  required: boolean;
  options: string[];
};
type Event = {
  id: string;
  title: string;
  description: string;
  description_en: string;
  starts_at: string;
  ends_at: string;
  location: string;
  status: string;
  questions: Question[];
  revision: number;
};
type Memory = {
  id: string;
  event_id: string;
  owner_id: string;
  title: string;
  body: string;
  visibility: string;
  status: string;
};
type Organization = {
  role: string;
  organization: { id: string; name: string };
};
type Application = {
  id: string;
  member_id: string;
  display_name: string;
  status: string;
  attended: boolean;
};
type Details = {
  event: Event;
  canManage: boolean;
  myApplication: {
    status: string;
    answers: Record<string, string | string[]>;
  } | null;
  announcements: {
    id: string;
    body_ko: string;
    body_en: string;
    application_url: string;
  }[];
};
type Context = {
  user: User | null;
  ko: boolean;
  t: (ko: string, en: string) => string;
  refreshUser: () => Promise<void>;
  setKo: (ko: boolean) => void;
};
const Session = createContext<Context>(null!);
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const color = {
  ink: "#202825",
  muted: "#63716B",
  green: "#176C54",
  line: "#DEE5E1",
  bg: "#F8FAF9",
  red: "#AD353B",
  gold: "#B88830",
};
const statuses: Record<string, [string, string]> = {
  draft: ["초안", "Draft"],
  scheduled: ["예정", "Scheduled"],
  open: ["신청 중", "Open"],
  closed: ["마감", "Closed"],
  completed: ["종료", "Completed"],
  cancelled: ["취소", "Cancelled"],
  pending: ["승인 대기", "Pending"],
  approved: ["승인", "Approved"],
  rejected: ["미승인", "Rejected"],
  waitlist: ["대기", "Waitlisted"],
  published: ["게시됨", "Published"],
};
function useApp() {
  return useContext(Session);
}
function statusLabel(status: string, ko: boolean) {
  return statuses[status]?.[ko ? 0 : 1] || status;
}
function message(error: unknown, ko: boolean) {
  const code = error instanceof ApiError ? error.code : "NETWORK";
  const labels: Record<string, [string, string]> = {
    APP_NOT_ENABLED: [
      "앱 서비스가 아직 공개되지 않았습니다.",
      "The app service is not available yet.",
    ],
    LOGIN_REQUIRED: ["로그인이 필요합니다.", "Please sign in."],
    NATIVE_LOGIN_REQUIRED: [
      "로그인은 설치된 앱에서 진행해 주세요.",
      "Please sign in from the installed app.",
    ],
    ALREADY_APPLIED: ["이미 신청한 행사입니다.", "You have already applied."],
    APPLICATION_CLOSED: ["신청이 마감되었습니다.", "Applications are closed."],
    FORBIDDEN: ["이 작업을 할 권한이 없습니다.", "You do not have access."],
    ATTENDANCE_REQUIRED: [
      "출석 확인이 필요합니다.",
      "Verified attendance is required.",
    ],
    EVENT_NOT_FINISHED: [
      "행사가 종료된 후 완료할 수 있습니다.",
      "The event has not finished yet.",
    ],
    INVALID_DATE_TIMEZONE: [
      "날짜와 시간대를 확인해 주세요.",
      "Check the dates and time zone.",
    ],
    DELETION_PENDING: [
      "계정 삭제 요청이 접수되어 접근이 제한됩니다.",
      "An account deletion request is pending.",
    ],
    NETWORK: [
      "연결을 확인하고 다시 시도해 주세요.",
      "Check your connection and try again.",
    ],
  };
  return (
    labels[code]?.[ko ? 0 : 1] ||
    (ko
      ? "요청을 처리하지 못했습니다. 다시 시도해 주세요."
      : "Unable to complete the request. Please retry.")
  );
}
function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  danger = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        (busy || disabled) && s.disabled,
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? color.green : "#FFF"} />
      ) : (
        icon
      )}
      <Text
        style={[
          s.buttonText,
          secondary && { color: color.ink },
          danger && { color: color.red },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  numeric = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? "number-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor={color.muted}
        style={[s.input, multiline && s.multiline]}
      />
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={s.toggle}>
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color.green }}
      />
    </View>
  );
}
function Page({
  children,
  refresh,
}: {
  children: React.ReactNode;
  refresh?: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? (
            <RefreshControl refreshing={false} onRefresh={refresh} />
          ) : undefined
        }
        contentContainerStyle={s.page}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Feedback({
  error,
  busy,
  retry,
}: {
  error: string;
  busy: boolean;
  retry?: () => void;
}) {
  const { t } = useApp();
  return (
    <>
      {busy && <ActivityIndicator style={s.loading} color={color.green} />}
      {!!error && (
        <View style={s.feedback}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          {retry && (
            <Button
              secondary
              label={t("다시 시도", "Retry")}
              onPress={retry}
              icon={<RefreshCw size={18} color={color.green} />}
            />
          )}
        </View>
      )}
    </>
  );
}
function EventCard({ event, navigation }: { event: Event; navigation: any }) {
  const { ko } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={event.title}
      onPress={() => navigation.navigate("Event", { id: event.id })}
      style={s.card}
    >
      <View style={s.row}>
        <Text style={s.badge}>{statusLabel(event.status, ko)}</Text>
        <ArrowRight color={color.muted} size={20} />
      </View>
      <Text style={s.cardTitle}>{event.title}</Text>
      <Text style={s.meta}>
        {new Date(event.starts_at).toLocaleString(ko ? "ko-KR" : "en-US")}
      </Text>
      <Text style={s.meta}>{event.location}</Text>
    </Pressable>
  );
}
function EventList({ navigation, home = false }: any) {
  const { user, t, ko } = useApp();
  const [events, setEvents] = useState<Event[]>([]),
    [managed, setManaged] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    api<{ events: Event[] }>(
      `events${managed ? "?managed=true" : ""}`,
      undefined,
      controller.signal,
    )
      .then((r) => setEvents(r.events))
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e, ko));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [managed, ko]);
  useFocusEffect(load);
  return (
    <Page refresh={load}>
      {home ? (
        <View style={s.brand}>
          <Image source={require("./assets/icon.png")} style={s.logo} />
          <Text style={s.title}>WOOHYUKMON</Text>
        </View>
      ) : (
        <Text style={s.title}>{t("행사", "Events")}</Text>
      )}
      <View style={s.row}>
        <Text style={s.heading}>
          {managed
            ? t("운영 중인 행사", "Managed events")
            : t("공개 행사", "Public events")}
        </Text>
        {!!user && (
          <Button
            secondary
            label={managed ? t("전체", "All") : t("내 행사", "Managed")}
            onPress={() => setManaged(!managed)}
          />
        )}
      </View>
      <Feedback error={error} busy={busy} retry={load} />
      {!busy && !error && !events.length && (
        <Text style={s.empty}>
          {t("아직 등록된 행사가 없습니다.", "No events yet.")}
        </Text>
      )}
      {events.map((e) => (
        <EventCard key={e.id} event={e} navigation={navigation} />
      ))}
    </Page>
  );
}
function Questions({
  questions,
  answers,
  setAnswers,
}: {
  questions: Question[];
  answers: Record<string, string | string[]>;
  setAnswers: (answers: Record<string, string | string[]>) => void;
}) {
  return (
    <>
      {questions.map((q) =>
        q.type === "text" || q.type === "paragraph" ? (
          <Field
            key={q.id}
            label={`${q.title}${q.required ? " *" : ""}`}
            value={String(answers[q.id] || "")}
            multiline={q.type === "paragraph"}
            onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
          />
        ) : (
          <View key={q.id} style={s.field}>
            <Text style={s.label}>
              {q.title}
              {q.required ? " *" : ""}
            </Text>
            {q.options.map((option) => {
              const checked =
                q.type === "single"
                  ? answers[q.id] === option
                  : Array.isArray(answers[q.id]) &&
                    answers[q.id].includes(option);
              return (
                <Pressable
                  key={option}
                  accessibilityRole={q.type === "single" ? "radio" : "checkbox"}
                  accessibilityState={{ checked }}
                  accessibilityLabel={option}
                  style={[s.choice, checked && s.selected]}
                  onPress={() =>
                    setAnswers({
                      ...answers,
                      [q.id]:
                        q.type === "single"
                          ? option
                          : checked
                            ? (answers[q.id] as string[]).filter(
                                (x) => x !== option,
                              )
                            : [
                                ...(Array.isArray(answers[q.id])
                                  ? (answers[q.id] as string[])
                                  : []),
                                option,
                              ],
                    })
                  }
                >
                  <Text style={s.text}>{option}</Text>
                  {checked && <Check size={18} color={color.green} />}
                </Pressable>
              );
            })}
          </View>
        ),
      )}
    </>
  );
}
function EventScreen({ route, navigation }: any) {
  const { user, ko, t } = useApp();
  const id = route.params.id;
  const [data, setData] = useState<Details | null>(null),
    [answers, setAnswers] = useState<Record<string, string | string[]>>({}),
    [memories, setMemories] = useState<Memory[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    let active = true;
    setBusy(true);
    setError("");
    Promise.all([
      api<Details>(`events/${id}`),
      api<{ memories: Memory[] }>(`events/${id}/memories`),
    ])
      .then(([r, m]) => {
        if (active) {
          setData(r);
          setAnswers(r.myApplication?.answers || {});
          setMemories(m.memories);
        }
      })
      .catch((e) => {
        if (active) setError(message(e, ko));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, ko, user?.id]);
  useFocusEffect(load);
  async function act(action: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await api(`events/${id}/${action}`, body);
      load();
    } catch (e) {
      setError(message(e, ko));
      setBusy(false);
    }
  }
  return (
    <Page refresh={load}>
      <Feedback error={error} busy={busy} retry={load} />
      {data && (
        <>
          <Text style={s.badge}>{statusLabel(data.event.status, ko)}</Text>
          <Text style={s.title}>{data.event.title}</Text>
          <Text style={s.meta}>
            {new Date(data.event.starts_at).toLocaleString(
              ko ? "ko-KR" : "en-US",
            )}{" "}
            · {data.event.location}
          </Text>
          <Text style={s.prose}>
            {(!ko && data.event.description_en) || data.event.description}
          </Text>
          {data.canManage && (
            <Button
              secondary
              label={t("행사 관리", "Manage event")}
              onPress={() => navigation.navigate("Manage", { id })}
            />
          )}
          {data.announcements.map((n) => (
            <View key={n.id} style={s.section}>
              <Text style={s.prose}>
                {ko ? n.body_ko : n.body_en || n.body_ko}
              </Text>
              <Button
                secondary
                label={t("공지 복사", "Copy notice")}
                onPress={() => {
                  void Clipboard.setStringAsync(
                    ko ? n.body_ko : n.body_en || n.body_ko,
                  );
                }}
              />
              {!!n.application_url && (
                <Button
                  secondary
                  label={t("링크 복사", "Copy link")}
                  onPress={() => {
                    void Clipboard.setStringAsync(n.application_url);
                  }}
                />
              )}
            </View>
          ))}
          <View style={s.section}>
            <Text style={s.heading}>{t("신청", "Application")}</Text>
            {!user ? (
              <Button
                label={t("로그인", "Sign in")}
                onPress={() => navigation.navigate("Main", { screen: "My" })}
              />
            ) : data.myApplication &&
              data.myApplication.status !== "cancelled" ? (
              <>
                <Text style={s.text}>
                  {statusLabel(data.myApplication.status, ko)}
                </Text>
                {!["completed", "cancelled"].includes(data.event.status) && (
                  <Button
                    secondary
                    busy={busy}
                    label={t("신청 취소", "Cancel application")}
                    onPress={() => void act("cancel")}
                  />
                )}
              </>
            ) : data.event.status === "open" ? (
              <>
                <Questions
                  questions={data.event.questions}
                  answers={answers}
                  setAnswers={setAnswers}
                />
                <Button
                  busy={busy}
                  disabled={user.readOnly}
                  label={t("신청하기", "Apply")}
                  onPress={() => void act("apply", { answers })}
                />
              </>
            ) : (
              <Text style={s.meta}>
                {t("현재 신청을 받지 않습니다.", "Applications are not open.")}
              </Text>
            )}
          </View>
          {data.event.status === "completed" && user && (
            <Button
              secondary
              label={t("추억 남기기", "Add memory")}
              onPress={() => navigation.navigate("Memory", { eventId: id })}
            />
          )}
          {memories.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              style={s.card}
              onPress={() =>
                navigation.navigate("Memory", {
                  eventId: id,
                  memory: m,
                  canManage: data.canManage,
                })
              }
            >
              <Text style={s.cardTitle}>{m.title}</Text>
              <Text numberOfLines={3} style={s.meta}>
                {m.body}
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </Page>
  );
}
function ManageScreen({ route }: any) {
  const { ko, t } = useApp();
  const id = route.params.id;
  const [data, setData] = useState<Details | null>(null),
    [applications, setApplications] = useState<Application[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [koNotice, setKoNotice] = useState(""),
    [enNotice, setEnNotice] = useState(""),
    [memberId, setMemberId] = useState("");
  const load = useCallback(() => {
    setBusy(true);
    Promise.all([
      api<Details>(`events/${id}`),
      api<{ applications: Application[] }>(`events/${id}/applications`),
    ])
      .then(([d, a]) => {
        setData(d);
        setApplications(a.applications);
      })
      .catch((e) => setError(message(e, ko)))
      .finally(() => setBusy(false));
  }, [id, ko]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function act(action: string, body: unknown) {
    setError("");
    setBusy(true);
    try {
      await api(`events/${id}/${action}`, body);
      load();
    } catch (e) {
      setError(message(e, ko));
      setBusy(false);
    }
  }
  const next: Record<string, string[]> = {
    draft: ["open", "scheduled", "cancelled"],
    scheduled: ["open", "draft", "cancelled"],
    open: ["closed", "cancelled"],
    closed: ["open", "completed", "cancelled"],
  };
  return (
    <Page refresh={load}>
      <Feedback error={error} busy={busy} />
      {data?.canManage && (
        <>
          <Text style={s.title}>{data.event.title}</Text>
          <Text style={s.badge}>{statusLabel(data.event.status, ko)}</Text>
          <View style={s.wrap}>
            {(next[data.event.status] || []).map((status) => (
              <Button
                key={status}
                secondary
                busy={busy}
                label={statusLabel(status, ko)}
                onPress={() => void act("status", { status })}
              />
            ))}
          </View>
          <Text style={s.heading}>
            {t("참가자", "Participants")} · {applications.length}
          </Text>
          {applications.map((a) => (
            <View key={a.id} style={s.card}>
              <Text style={s.cardTitle}>{a.display_name}</Text>
              <Text style={s.meta}>
                {statusLabel(a.status, ko)}
                {a.attended ? ` · ${t("출석 확인", "Attended")}` : ""}
              </Text>
              <View style={s.wrap}>
                {["pending", "waitlist"].includes(a.status) && (
                  <Button
                    secondary
                    busy={busy}
                    label={t("승인", "Approve")}
                    onPress={() =>
                      void act("review", {
                        applicationId: a.id,
                        status: "approved",
                      })
                    }
                  />
                )}
                {a.status === "approved" && !a.attended && (
                  <Button
                    secondary
                    busy={busy}
                    label={t("출석 확인", "Confirm attendance")}
                    onPress={() =>
                      void act("attendance", { memberId: a.member_id })
                    }
                  />
                )}
                {["pending", "approved", "waitlist"].includes(a.status) && (
                  <Button
                    danger
                    secondary
                    busy={busy}
                    label={t("미승인", "Reject")}
                    onPress={() =>
                      void act("review", {
                        applicationId: a.id,
                        status: "rejected",
                      })
                    }
                  />
                )}
              </View>
            </View>
          ))}
          <View style={s.section}>
            <Text style={s.heading}>{t("공지", "Announcement")}</Text>
            <Field
              label={t("한국어 공지", "Korean notice")}
              multiline
              value={koNotice}
              onChange={setKoNotice}
            />
            <Field
              label={t("영어 공지", "English notice")}
              multiline
              value={enNotice}
              onChange={setEnNotice}
            />
            <Button
              busy={busy}
              disabled={!koNotice.trim() && !enNotice.trim()}
              label={t("공지 게시", "Publish notice")}
              onPress={() =>
                void act("announcements", {
                  bodyKo: koNotice,
                  bodyEn: enNotice,
                  status: "published",
                })
              }
            />
          </View>
          <View style={s.section}>
            <Field
              label={t("운영진 회원 ID", "Manager member ID")}
              value={memberId}
              onChange={setMemberId}
            />
            <Button
              secondary
              busy={busy}
              label={t("행사 운영진 지정", "Assign event manager")}
              onPress={() => void act("roles", { memberId, role: "manager" })}
            />
          </View>
        </>
      )}
    </Page>
  );
}
function CreateScreen({ navigation }: any) {
  const { user, t, ko } = useApp();
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [organizationId, setOrganizationId] = useState(""),
    [organizationName, setOrganizationName] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [descriptionEn, setDescriptionEn] = useState(""),
    [location, setLocation] = useState(""),
    [startsAt, setStartsAt] = useState(""),
    [endsAt, setEndsAt] = useState(""),
    [openAt, setOpenAt] = useState(""),
    [closeAt, setCloseAt] = useState(""),
    [capacity, setCapacity] = useState(""),
    [waitlist, setWaitlist] = useState(true),
    [manual, setManual] = useState(false),
    [membersOnly, setMembersOnly] = useState(false),
    [online, setOnline] = useState(false),
    [questions, setQuestions] = useState<Question[]>([]),
    [notice, setNotice] = useState({ ko: "", en: "" }),
    [prompt, setPrompt] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!user) return;
    api<{ organizations: Organization[] }>("organizations")
      .then((r) => {
        const rows = r.organizations.filter((o) =>
          ["owner", "admin"].includes(o.role),
        );
        setOrganizations(rows);
        setOrganizationId((id) => id || rows[0]?.organization.id || "");
      })
      .catch((e) => setError(message(e, ko)));
  }, [user?.id, ko]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(message(e, ko));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    const result = await api<{ id: string }>("events", {
      organizationId,
      title,
      description,
      descriptionEn,
      location,
      startsAt,
      endsAt,
      applicationsOpenAt: openAt,
      applicationsCloseAt: closeAt,
      capacity: capacity ? Number(capacity) : null,
      waitlist,
      approval: manual ? "manual" : "automatic",
      online,
      visibility: membersOnly ? "members" : "public",
      questions,
    });
    if (notice.ko || notice.en) {
      try {
        await api(`events/${result.id}/announcements`, {
          bodyKo: notice.ko,
          bodyEn: notice.en,
          status: "draft",
        });
      } catch {
        Alert.alert(t("공지 초안 저장 실패", "Notice draft was not saved"));
      }
    }
    navigation.navigate("Event", { id: result.id });
  }
  if (!user)
    return (
      <Page>
        <Text style={s.title}>{t("만들기", "Create")}</Text>
        <Button
          label={t("로그인", "Sign in")}
          onPress={() => navigation.navigate("My")}
        />
      </Page>
    );
  return (
    <Page>
      <Text style={s.title}>{t("행사 만들기", "Create event")}</Text>
      <Feedback error={error} busy={busy} />
      <Text style={s.label}>{t("주최 단체", "Organization")}</Text>
      <View style={s.wrap}>
        {organizations.map((o) => (
          <Button
            key={o.organization.id}
            secondary={organizationId !== o.organization.id}
            label={o.organization.name}
            onPress={() => setOrganizationId(o.organization.id)}
          />
        ))}
      </View>
      {!organizations.length && (
        <>
          <Field
            label={t("단체 이름", "Organization name")}
            value={organizationName}
            onChange={setOrganizationName}
          />
          <Button
            secondary
            busy={busy}
            disabled={!organizationName.trim() || user.readOnly}
            label={t("단체 만들기", "Create organization")}
            onPress={() =>
              void run(async () => {
                const r = await api<{ id: string }>("organizations", {
                  name: organizationName,
                });
                setOrganizationId(r.id);
                load();
              })
            }
          />
        </>
      )}
      <View style={s.section}>
        <Field
          label={t("행사 아이디어", "Event idea")}
          value={prompt}
          multiline
          onChange={setPrompt}
        />
        <Button
          secondary
          busy={busy}
          disabled={!organizationId || !prompt.trim() || user.readOnly}
          label={t("AI 초안 만들기", "Generate AI draft")}
          icon={<WandSparkles color={color.green} size={18} />}
          onPress={() =>
            void run(async () => {
              const r = await api<{
                draft: {
                  title: string;
                  description: string;
                  descriptionEn: string;
                  questions: Question[];
                  noticeKo: string;
                  noticeEn: string;
                };
              }>("ai", { organizationId, message: prompt });
              setTitle(r.draft.title);
              setDescription(r.draft.description);
              setDescriptionEn(r.draft.descriptionEn);
              setQuestions(r.draft.questions);
              setNotice({ ko: r.draft.noticeKo, en: r.draft.noticeEn });
            })
          }
        />
      </View>
      <Field label={t("제목", "Title")} value={title} onChange={setTitle} />
      <Field
        label={t("소개", "Description")}
        value={description}
        onChange={setDescription}
        multiline
      />
      <Field
        label={t("영어 소개", "English description")}
        value={descriptionEn}
        onChange={setDescriptionEn}
        multiline
      />
      <Field
        label={t("장소", "Location")}
        value={location}
        onChange={setLocation}
      />
      {[
        [t("시작", "Starts"), startsAt, setStartsAt],
        [t("종료", "Ends"), endsAt, setEndsAt],
        [t("신청 시작", "Applications open"), openAt, setOpenAt],
        [t("신청 마감", "Application deadline"), closeAt, setCloseAt],
      ].map(([label, value, change]) => (
        <Field
          key={label as string}
          label={label as string}
          value={value as string}
          onChange={change as (v: string) => void}
          placeholder="2026-10-20T18:00:00+09:00"
        />
      ))}
      <Field
        label={t("정원", "Capacity")}
        value={capacity}
        numeric
        onChange={setCapacity}
      />
      <Toggle
        label={t("대기 신청", "Waitlist")}
        value={waitlist}
        onChange={setWaitlist}
      />
      <Toggle
        label={t("관리자 승인", "Manual approval")}
        value={manual}
        onChange={setManual}
      />
      <Toggle
        label={t("단체 회원만", "Organization members only")}
        value={membersOnly}
        onChange={setMembersOnly}
      />
      <Toggle
        label={t("온라인 행사", "Online event")}
        value={online}
        onChange={setOnline}
      />
      <Text style={s.heading}>{t("신청 질문", "Application questions")}</Text>
      {questions.map((q, i) => (
        <View key={q.id} style={s.section}>
          <Field
            label={`${i + 1}. ${t("질문", "Question")}`}
            value={q.title}
            onChange={(value) =>
              setQuestions(
                questions.map((x) =>
                  x.id === q.id ? { ...x, title: value } : x,
                ),
              )
            }
          />
          <View style={s.wrap}>
            {(["text", "paragraph", "single", "multiple"] as const).map(
              (type) => (
                <Button
                  key={type}
                  secondary={q.type !== type}
                  label={
                    {
                      text: t("단답형", "Short"),
                      paragraph: t("장문형", "Long"),
                      single: t("하나 선택", "Single"),
                      multiple: t("복수 선택", "Multiple"),
                    }[type]
                  }
                  onPress={() =>
                    setQuestions(
                      questions.map((x) =>
                        x.id === q.id
                          ? {
                              ...x,
                              type,
                              options: ["single", "multiple"].includes(type)
                                ? x.options.length
                                  ? x.options
                                  : ["", ""]
                                : [],
                            }
                          : x,
                      ),
                    )
                  }
                />
              ),
            )}
          </View>
          {["single", "multiple"].includes(q.type) && (
            <Field
              multiline
              label={t("선택지", "Options")}
              value={q.options.join("\n")}
              onChange={(v) =>
                setQuestions(
                  questions.map((x) =>
                    x.id === q.id ? { ...x, options: v.split("\n") } : x,
                  ),
                )
              }
            />
          )}
          <Toggle
            label={t("필수", "Required")}
            value={q.required}
            onChange={(value) =>
              setQuestions(
                questions.map((x) =>
                  x.id === q.id ? { ...x, required: value } : x,
                ),
              )
            }
          />
          <Button
            secondary
            danger
            label={t("질문 삭제", "Remove question")}
            icon={<Trash2 color={color.red} size={18} />}
            onPress={() => setQuestions(questions.filter((x) => x.id !== q.id))}
          />
        </View>
      ))}
      <Button
        secondary
        disabled={questions.length >= 15}
        label={t("질문 추가", "Add question")}
        icon={<Plus size={18} color={color.green} />}
        onPress={() =>
          setQuestions([
            ...questions,
            {
              id: `q_${Date.now()}`,
              title: "",
              type: "text",
              required: true,
              options: [],
            },
          ])
        }
      />
      {(notice.ko || notice.en) && (
        <View style={s.section}>
          <Field
            label={t("한국어 공지 초안", "Korean notice draft")}
            multiline
            value={notice.ko}
            onChange={(v) => setNotice({ ...notice, ko: v })}
          />
          <Field
            label={t("영어 공지 초안", "English notice draft")}
            multiline
            value={notice.en}
            onChange={(v) => setNotice({ ...notice, en: v })}
          />
        </View>
      )}
      <Button
        busy={busy}
        disabled={!organizationId || !title.trim() || user.readOnly}
        label={t("행사 초안 저장", "Save event draft")}
        onPress={() => void run(create)}
      />
    </Page>
  );
}
function MemoryList({ navigation }: any) {
  const { user, t, ko } = useApp();
  const [events, setEvents] = useState<Event[]>([]),
    [memories, setMemories] = useState<Memory[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!user) {
      setEvents([]);
      setMemories([]);
      return;
    }
    setBusy(true);
    setError("");
    api<{ events: Event[]; memories: Memory[] }>("memories")
      .then((r) => {
        setEvents(r.events);
        setMemories(r.memories);
      })
      .catch((e) => setError(message(e, ko)))
      .finally(() => setBusy(false));
  }, [user?.id, ko]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <Page refresh={load}>
      <Text style={s.title}>{t("추억록", "Memories")}</Text>
      <Feedback error={error} busy={busy} retry={load} />
      {!user ? (
        <Button
          label={t("로그인", "Sign in")}
          onPress={() => navigation.navigate("My")}
        />
      ) : (
        <>
          {!busy && !error && !events.length && (
            <Text style={s.empty}>
              {t(
                "출석 확인된 종료 행사가 없습니다.",
                "No completed events with verified attendance yet.",
              )}
            </Text>
          )}
          {events.map((e) => (
            <EventCard key={e.id} event={e} navigation={navigation} />
          ))}
          {memories.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              style={s.card}
              onPress={() =>
                navigation.navigate("Memory", {
                  eventId: m.event_id,
                  memory: m,
                })
              }
            >
              <Text style={s.cardTitle}>{m.title}</Text>
              <Text style={s.meta}>{statusLabel(m.status, ko)}</Text>
            </Pressable>
          ))}
        </>
      )}
    </Page>
  );
}
function MemoryScreen({ route, navigation }: any) {
  const { user, t, ko } = useApp();
  const initial: Memory | undefined = route.params.memory,
    eventId = route.params.eventId;
  const [id, setId] = useState(initial?.id || ""),
    [title, setTitle] = useState(initial?.title || ""),
    [body, setBody] = useState(initial?.body || ""),
    [visibility, setVisibility] = useState(initial?.visibility || "private"),
    [consent, setConsent] = useState(false),
    [photos, setPhotos] = useState<{ id: string; url: string }[]>([]),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const owner = !initial || initial.owner_id === user?.id;
  const loadPhotos = useCallback(() => {
    if (id)
      api<{ photos: { id: string; url: string }[] }>(`media?memoryId=${id}`)
        .then((r) => setPhotos(r.photos))
        .catch((e) => setError(message(e, ko)));
  }, [id, ko]);
  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(message(e, ko));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const r = await api<{ id: string }>(`events/${eventId}/memories`, {
      ...(id ? { memoryId: id } : {}),
      title,
      body,
      visibility,
      photoConsent: consent,
    });
    setId(r.id);
    Alert.alert(t("저장되었습니다.", "Saved."));
  }
  async function photo() {
    const chosen = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (chosen.canceled) return;
    const processed = await ImageManipulator.manipulateAsync(
      chosen.assets[0].uri,
      [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    await upload(id, processed.uri, consent);
    loadPhotos();
  }
  return (
    <Page>
      <Feedback error={error} busy={busy} />
      {owner ? (
        <>
          <Field label={t("제목", "Title")} value={title} onChange={setTitle} />
          <Field
            label={t("추억", "Memory")}
            multiline
            value={body}
            onChange={setBody}
          />
          <View style={s.wrap}>
            {["private", "participants", "public"].map((v) => (
              <Button
                key={v}
                secondary={visibility !== v}
                label={
                  v === "private"
                    ? t("나만", "Only me")
                    : v === "participants"
                      ? t("참가자", "Participants")
                      : t("공개", "Public")
                }
                onPress={() => setVisibility(v)}
              />
            ))}
          </View>
          <Toggle
            label={t(
              "사진 속 인물의 공유 동의 확인",
              "Consent from people in shared photos",
            )}
            value={consent}
            onChange={setConsent}
          />
          <Button
            disabled={
              !title.trim() ||
              user?.readOnly ||
              (!consent && visibility !== "private")
            }
            busy={busy}
            label={t("저장", "Save")}
            onPress={() => void run(save)}
          />
          {!!id && (
            <Button
              secondary
              busy={busy}
              disabled={!consent || user?.readOnly}
              label={t("사진 추가", "Add photo")}
              onPress={() => void run(photo)}
            />
          )}
        </>
      ) : (
        <>
          <Text style={s.title}>{title}</Text>
          <Text style={s.prose}>{body}</Text>
        </>
      )}
      {photos.map((p) => (
        <Image
          key={p.id}
          source={{ uri: p.url }}
          style={s.photo}
          accessibilityLabel={title}
        />
      ))}
      {!!photos.length && (
        <Button
          secondary
          label={t("사진 새로고침", "Refresh photos")}
          onPress={loadPhotos}
        />
      )}
      {!!initial && !owner && user && (
        <View style={s.section}>
          <Field
            label={t("신고 사유", "Report reason")}
            value={reason}
            multiline
            onChange={setReason}
          />
          <Button
            secondary
            danger
            busy={busy}
            disabled={!reason.trim()}
            label={t("신고", "Report")}
            onPress={() =>
              void run(async () => {
                await api(`events/${eventId}/reports`, {
                  memoryId: id,
                  reason,
                });
                Alert.alert(t("신고가 접수되었습니다.", "Report received."));
              })
            }
          />
          <Button
            secondary
            danger
            busy={busy}
            label={t("작성자 차단", "Block author")}
            onPress={() =>
              void run(async () => {
                await api("blocks", { memberId: initial.owner_id });
                navigation.goBack();
              })
            }
          />
        </View>
      )}
      {route.params.canManage && id && (
        <View style={s.wrap}>
          {["published", "hidden"].map((status) => (
            <Button
              key={status}
              secondary
              busy={busy}
              label={
                status === "published"
                  ? t("게시 승인", "Approve memory")
                  : t("숨기기", "Hide memory")
              }
              onPress={() =>
                void run(async () => {
                  await api(`events/${eventId}/moderate`, {
                    memoryId: id,
                    status,
                  });
                  navigation.goBack();
                })
              }
            />
          ))}
        </View>
      )}
    </Page>
  );
}
function MyScreen() {
  const { user, t, ko, setKo, refreshUser } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState("");
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(message(e, ko));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Text style={s.title}>{t("마이", "My")}</Text>
      <Text style={s.heading}>{user?.name || t("로그인", "Sign in")}</Text>
      <Feedback error={error} busy={busy} />
      {!user ? (
        <Button
          busy={busy}
          label={t("K_LINE 계정으로 로그인", "Sign in with K_LINE")}
          onPress={() =>
            void run(async () => {
              if (await login()) await refreshUser();
            })
          }
        />
      ) : (
        <>
          <Text selectable style={s.meta}>
            {user.id}
          </Text>
          <Button
            secondary
            busy={busy}
            label={t("로그아웃", "Sign out")}
            onPress={() =>
              void run(async () => {
                await api("logout", {});
                await forgetSession();
                await refreshUser();
              })
            }
          />
        </>
      )}
      <View style={s.section}>
        <Text style={s.label}>{t("언어", "Language")}</Text>
        <View style={s.wrap}>
          <Button label="한국어" secondary={!ko} onPress={() => setKo(true)} />
          <Button label="English" secondary={ko} onPress={() => setKo(false)} />
        </View>
      </View>
      {!!user && (
        <View style={s.section}>
          <Text style={s.heading}>
            {t("계정 삭제 요청", "Request account deletion")}
          </Text>
          <Field
            label={t("확인을 위해 DELETE 입력", "Type DELETE to confirm")}
            value={confirm}
            onChange={setConfirm}
          />
          <Button
            secondary
            danger
            busy={busy}
            disabled={confirm !== "DELETE"}
            label={t("삭제 요청", "Request deletion")}
            onPress={() =>
              void run(async () => {
                await api("deletion-request", {});
                await forgetSession();
                await refreshUser();
              })
            }
          />
        </View>
      )}
    </Page>
  );
}
function MainTabs() {
  const { t } = useApp();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.green,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: {
          borderTopColor: color.line,
          height: Platform.OS === "web" ? 70 : undefined,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="Home"
        options={{
          title: t("홈", "Home"),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      >
        {(props) => <EventList {...props} home />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Events"
        component={EventList}
        options={{
          title: t("행사", "Events"),
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Memories"
        component={MemoryList}
        options={{
          title: t("추억록", "Memories"),
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Create"
        component={CreateScreen}
        options={{
          title: t("만들기", "Create"),
          tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="My"
        component={MyScreen}
        options={{
          title: t("마이", "My"),
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [ko, setKo] = useState(getLocales()[0]?.languageCode === "ko"),
    [ready, setReady] = useState(false);
  const refreshUser = useCallback(async () => {
    const r = await api<{ user: User | null }>("me");
    setUser(r.user);
  }, []);
  useEffect(() => {
    let active = true;
    restoreSession()
      .then(refreshUser)
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [refreshUser]);
  const t = (kr: string, en: string) => (ko ? kr : en);
  return (
    <SafeAreaProvider>
      <Session.Provider value={{ user, ko, t, setKo, refreshUser }}>
        <StatusBar style="dark" />
        {!ready ? (
          <View style={[s.fill, { justifyContent: "center" }]}>
            <ActivityIndicator color={color.green} />
          </View>
        ) : (
          <NavigationContainer
            linking={{
              prefixes: ["woohyukmon://"],
              config: { screens: { Event: "events/:id" } },
            }}
          >
            <Stack.Navigator
              screenOptions={{
                headerTintColor: color.ink,
                headerStyle: { backgroundColor: "#FFFFFF" },
                contentStyle: { backgroundColor: color.bg },
              }}
            >
              <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{
                  title: "WOOHYUKMON",
                  headerTitleStyle: { fontSize: 17 },
                }}
              />
              <Stack.Screen
                name="Event"
                component={EventScreen}
                options={{ title: t("행사", "Event") }}
              />
              <Stack.Screen
                name="Manage"
                component={ManageScreen}
                options={{ title: t("행사 관리", "Manage event") }}
              />
              <Stack.Screen
                name="Memory"
                component={MemoryScreen}
                options={{ title: t("추억록", "Memory") }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </Session.Provider>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  page: {
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 40,
  },
  brand: { alignItems: "center", paddingVertical: 24, gap: 12 },
  logo: { width: 112, height: 112 },
  title: { fontSize: 28, fontWeight: "700", color: color.ink, flexShrink: 1 },
  heading: { fontSize: 20, fontWeight: "700", color: color.ink, flexShrink: 1 },
  text: { fontSize: 16, color: color.ink },
  meta: { fontSize: 14, lineHeight: 22, color: color.muted },
  prose: { fontSize: 16, lineHeight: 26, color: color.ink },
  badge: { fontSize: 13, color: color.green, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    backgroundColor: color.green,
    borderWidth: 1,
    borderColor: color.green,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  buttonText: { color: "#FFF", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  secondary: { backgroundColor: "#FFFFFF", borderColor: color.line },
  danger: { backgroundColor: "#FFF", borderColor: "#E3BDBD" },
  disabled: { opacity: 0.45 },
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 8,
    padding: 18,
    gap: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: "600", color: color.ink },
  section: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 20,
    gap: 14,
  },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: color.ink },
  input: {
    backgroundColor: "#FFF",
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: 6,
    padding: 13,
    fontSize: 16,
    color: color.ink,
    minHeight: 48,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 48,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 6,
    padding: 14,
    minHeight: 48,
  },
  selected: { borderColor: color.green, backgroundColor: "#EEF7F2" },
  feedback: { gap: 12, paddingVertical: 8 },
  error: { color: color.red, fontSize: 15, lineHeight: 23 },
  loading: { paddingVertical: 12 },
  empty: { fontSize: 16, color: color.muted, paddingVertical: 36 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    resizeMode: "contain",
    backgroundColor: "#E8EFEB",
  },
});
