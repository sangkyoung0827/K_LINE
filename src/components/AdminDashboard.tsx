"use client";

import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  HeartHandshake,
  Package,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { adminStorageKeys } from "@/lib/adminStorageKeys";
import {
  readFreeBoardPosts,
  sortPostsByNewest,
  writeFreeBoardPosts
} from "@/lib/freeBoardStorage";
import type { FreeBoard, FreeBoardPost } from "@/types";

type AdminDashboardProps = {
  adminEmail: string;
  adminName: string;
};

type AdminMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "paused";
  createdAt: string;
};

type OrderInquiry = {
  name?: string;
  email?: string;
  message?: string;
  selectedGoods?: {
    slug: string;
    name: string;
    koreanName: string;
    quantity: number;
    estimatedPriceEur: number;
  }[];
  estimatedTotalEur?: number;
  createdAt?: string;
};

type DonationPledge = {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  amountKrw: number;
  message: string;
  status: "pledged" | "received";
  createdAt: string;
};

type BankSnapshot = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  displayBalanceKrw: number;
  updatedAt: string;
};

type BoardPostRow = {
  board: FreeBoard;
  post: FreeBoardPost;
};

const memberInitialState = {
  name: "",
  email: "",
  role: "member"
};

const defaultBankSnapshot: BankSnapshot = {
  bankName: process.env.NEXT_PUBLIC_DONATION_BANK_NAME ?? "",
  accountNumber: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_NUMBER ?? "",
  accountHolder: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_HOLDER ?? "",
  displayBalanceKrw: Number(process.env.NEXT_PUBLIC_DONATION_BALANCE_KRW ?? 0),
  updatedAt: ""
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

export function AdminDashboard({ adminEmail, adminName }: AdminDashboardProps) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberForm, setMemberForm] = useState(memberInitialState);
  const [orders, setOrders] = useState<OrderInquiry[]>([]);
  const [donations, setDonations] = useState<DonationPledge[]>([]);
  const [bankSnapshot, setBankSnapshot] = useState(defaultBankSnapshot);
  const [bankForm, setBankForm] = useState({
    ...defaultBankSnapshot,
    displayBalanceKrw: String(defaultBankSnapshot.displayBalanceKrw || "")
  });
  const [boardPosts, setBoardPosts] = useState<BoardPostRow[]>([]);

  const refresh = () => {
    setMembers(readJson<AdminMember[]>(adminStorageKeys.adminMembers, []));
    setOrders(readJson<OrderInquiry[]>(adminStorageKeys.orderInquiries, []));
    setDonations(readJson<DonationPledge[]>(adminStorageKeys.donationPledges, []));
    const nextBankSnapshot = readJson<BankSnapshot>(
      adminStorageKeys.bankSnapshot,
      defaultBankSnapshot
    );
    setBankSnapshot(nextBankSnapshot);
    setBankForm({
      ...nextBankSnapshot,
      displayBalanceKrw: String(nextBankSnapshot.displayBalanceKrw || "")
    });
    setBoardPosts(
      activityBoards.flatMap((board) =>
        sortPostsByNewest(readFreeBoardPosts(board)).map((post) => ({ board, post }))
      )
    );
  };

  useEffect(() => {
    refresh();
  }, []);

  const visibleMembers = useMemo(() => {
    const hasAdminRecord = members.some((member) => member.email === adminEmail);
    const adminRecord: AdminMember = {
      id: "current-super-admin",
      name: adminName,
      email: adminEmail,
      role: "super admin",
      status: "active",
      createdAt: new Date().toISOString()
    };

    return hasAdminRecord ? members : [adminRecord, ...members];
  }, [adminEmail, adminName, members]);

  const productStats = useMemo(
    () =>
      goods.map((item) => {
        const quantity = orders.reduce((total, order) => {
          const selected = order.selectedGoods?.find((line) => line.slug === item.slug);
          return total + (selected?.quantity ?? 0);
        }, 0);

        return {
          item,
          quantity,
          estimatedRevenueEur: quantity * item.estimatedPriceEur
        };
      }),
    [orders]
  );

  const estimatedRevenueEur = productStats.reduce(
    (total, stat) => total + stat.estimatedRevenueEur,
    0
  );
  const pledgedKrw = donations.reduce((total, donation) => total + donation.amountKrw, 0);
  const receivedKrw = donations
    .filter((donation) => donation.status === "received")
    .reduce((total, donation) => total + donation.amountKrw, 0);

  const addMember = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMember: AdminMember = {
      id: `member-${Date.now()}`,
      name: memberForm.name.trim(),
      email: memberForm.email.trim(),
      role: memberForm.role.trim() || "member",
      status: "active",
      createdAt: new Date().toISOString()
    };
    const nextMembers = [nextMember, ...members];
    writeJson(adminStorageKeys.adminMembers, nextMembers);
    setMembers(nextMembers);
    setMemberForm(memberInitialState);
  };

  const deleteMember = (memberId: string) => {
    const nextMembers = members.filter((member) => member.id !== memberId);
    writeJson(adminStorageKeys.adminMembers, nextMembers);
    setMembers(nextMembers);
  };

  const toggleMemberStatus = (memberId: string) => {
    const nextMembers: AdminMember[] = members.map((member) =>
      member.id === memberId
        ? {
            ...member,
            status: member.status === "active" ? "paused" : "active"
          }
        : member
    );
    writeJson(adminStorageKeys.adminMembers, nextMembers);
    setMembers(nextMembers);
  };

  const deletePost = (board: FreeBoard, postId: string) => {
    const nextPosts = readFreeBoardPosts(board).filter((post) => post.id !== postId);
    writeFreeBoardPosts(board, nextPosts);
    setBoardPosts((current) =>
      current.filter((row) => row.board.id !== board.id || row.post.id !== postId)
    );
  };

  const updateDonationStatus = (donationId: string, status: DonationPledge["status"]) => {
    const nextDonations = donations.map((donation) =>
      donation.id === donationId ? { ...donation, status } : donation
    );
    writeJson(adminStorageKeys.donationPledges, nextDonations);
    setDonations(nextDonations);
  };

  const deleteDonation = (donationId: string) => {
    const nextDonations = donations.filter((donation) => donation.id !== donationId);
    writeJson(adminStorageKeys.donationPledges, nextDonations);
    setDonations(nextDonations);
  };

  const saveBankSnapshot = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSnapshot: BankSnapshot = {
      bankName: bankForm.bankName.trim(),
      accountNumber: bankForm.accountNumber.trim(),
      accountHolder: bankForm.accountHolder.trim(),
      displayBalanceKrw: Number(bankForm.displayBalanceKrw || 0),
      updatedAt: new Date().toISOString()
    };
    writeJson(adminStorageKeys.bankSnapshot, nextSnapshot);
    setBankSnapshot(nextSnapshot);
  };

  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-brass">
            <ShieldCheck aria-hidden className="h-5 w-5" />
            Super Admin
          </div>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
            K_LINE Admin Console
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-paper/72">
            Logged in as {adminName} / {adminEmail}
          </p>
        </div>
      </section>

      <section className="bg-paper py-10 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 md:grid-cols-2 md:px-8 lg:grid-cols-4">
          <MetricCard
            icon={<ClipboardList aria-hidden className="h-5 w-5" />}
            label="Board posts"
            value={`${boardPosts.length}`}
            note="ECC + Han-hwal"
          />
          <MetricCard
            icon={<Package aria-hidden className="h-5 w-5" />}
            label="Order inquiries"
            value={`${orders.length}`}
            note={`Estimated EUR ${estimatedRevenueEur}`}
          />
          <MetricCard
            icon={<HeartHandshake aria-hidden className="h-5 w-5" />}
            label="Donation pledges"
            value={formatKrw(pledgedKrw)}
            note={`Received ${formatKrw(receivedKrw)}`}
          />
          <MetricCard
            icon={<Banknote aria-hidden className="h-5 w-5" />}
            label="Displayed balance"
            value={formatKrw(bankSnapshot.displayBalanceKrw)}
            note={bankSnapshot.updatedAt ? formatDate(bankSnapshot.updatedAt) : "Manual snapshot"}
          />
        </div>
      </section>

      <section className="bg-white/55 py-12 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:px-8 xl:grid-cols-[1fr_1fr]">
          <AdminPanel title="Member Management" icon={<Users aria-hidden className="h-5 w-5" />}>
            <form onSubmit={addMember} className="grid gap-3 md:grid-cols-[1fr_1fr_0.8fr_auto]">
              <input
                required
                className="form-field"
                placeholder="Name"
                value={memberForm.name}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                required
                type="email"
                className="form-field"
                placeholder="Email"
                value={memberForm.email}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, email: event.target.value }))
                }
              />
              <input
                className="form-field"
                placeholder="Role"
                value={memberForm.role}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, role: event.target.value }))
                }
              />
              <button className="min-h-11 bg-ink px-4 text-sm font-semibold text-paper" type="submit">
                Add
              </button>
            </form>
            <div className="mt-5 grid gap-3">
              {visibleMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-3 border border-ink/10 bg-white/60 p-4 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-ink">{member.name}</p>
                    <p className="mt-1 text-sm text-ink/62">{member.email}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-brass">
                      {member.role} / {member.status}
                    </p>
                  </div>
                  {member.id === "current-super-admin" ? null : (
                    <div className="flex gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => toggleMemberStatus(member.id)}
                        className="inline-flex h-10 items-center border border-ink/12 px-3 text-xs font-semibold text-ink hover:border-brass"
                      >
                        {member.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMember(member.id)}
                        className="inline-flex h-10 w-10 items-center justify-center border border-red-900/20 text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${member.name}`}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Post Deletion" icon={<Trash2 aria-hidden className="h-5 w-5" />}>
            {boardPosts.length > 0 ? (
              <div className="grid gap-3">
                {boardPosts.map(({ board, post }) => (
                  <div
                    key={`${board.id}-${post.id}`}
                    className="grid gap-4 border border-ink/10 bg-white/60 p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase text-brass">{board.label}</p>
                      <p className="mt-2 font-serif text-2xl font-semibold text-ink">{post.title}</p>
                      <p className="mt-1 text-sm text-ink/62">
                        {post.author} / {formatDate(post.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePost(board, post.id)}
                      className="inline-flex h-11 items-center justify-center gap-2 border border-red-900/20 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-ink/62">No free-board posts are stored yet.</p>
            )}
          </AdminPanel>

          <AdminPanel
            title="Orders And Revenue"
            icon={<CircleDollarSign aria-hidden className="h-5 w-5" />}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {productStats.map((stat) => (
                <div key={stat.item.id} className="border border-ink/10 bg-white/60 p-4">
                  <p className="text-xs font-semibold uppercase text-brass">{stat.item.koreanName}</p>
                  <p className="mt-2 font-semibold text-ink">{stat.item.name}</p>
                  <p className="mt-3 text-sm text-ink/62">Quantity: {stat.quantity}</p>
                  <p className="mt-1 text-sm text-ink/62">
                    Estimated revenue: EUR {stat.estimatedRevenueEur}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              {orders.length > 0 ? (
                orders.map((order, index) => (
                  <div key={`${order.createdAt}-${index}`} className="border border-ink/10 bg-white/60 p-4">
                    <p className="font-semibold text-ink">{order.name ?? "Unnamed order"}</p>
                    <p className="mt-1 text-sm text-ink/62">{order.email ?? "No email"}</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      Estimated total: EUR {order.estimatedTotalEur ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-ink/52">{formatDate(order.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-ink/62">No order inquiries are stored yet.</p>
              )}
            </div>
          </AdminPanel>

          <AdminPanel title="Donation And Bank Snapshot" icon={<Banknote aria-hidden className="h-5 w-5" />}>
            <form onSubmit={saveBankSnapshot} className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="form-field"
                  placeholder="Bank name"
                  value={bankForm.bankName}
                  onChange={(event) =>
                    setBankForm((current) => ({ ...current, bankName: event.target.value }))
                  }
                />
                <input
                  className="form-field"
                  placeholder="Account holder"
                  value={bankForm.accountHolder}
                  onChange={(event) =>
                    setBankForm((current) => ({ ...current, accountHolder: event.target.value }))
                  }
                />
              </div>
              <input
                className="form-field"
                placeholder="Account number"
                value={bankForm.accountNumber}
                onChange={(event) =>
                  setBankForm((current) => ({ ...current, accountNumber: event.target.value }))
                }
              />
              <input
                className="form-field"
                inputMode="numeric"
                placeholder="Displayed account balance KRW"
                value={bankForm.displayBalanceKrw}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    displayBalanceKrw: event.target.value.replace(/[^0-9]/g, "")
                  }))
                }
              />
              <button type="submit" className="min-h-11 bg-ink px-5 text-sm font-semibold text-paper">
                Save Snapshot
              </button>
            </form>

            <div className="mt-6 grid gap-3">
              {donations.length > 0 ? (
                donations.map((donation) => (
                  <div key={donation.id} className="border border-ink/10 bg-white/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{donation.name}</p>
                        <p className="mt-1 text-sm text-ink/62">{donation.email}</p>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          {formatKrw(donation.amountKrw)} / {donation.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateDonationStatus(donation.id, "received")}
                          className="inline-flex h-10 w-10 items-center justify-center border border-pine/20 text-pine hover:bg-pine/10"
                          aria-label="Mark donation received"
                        >
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDonation(donation.id)}
                          className="inline-flex h-10 w-10 items-center justify-center border border-red-900/20 text-red-700 hover:bg-red-50"
                          aria-label="Delete donation pledge"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {donation.message ? (
                      <p className="mt-3 text-sm leading-7 text-ink/62">{donation.message}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-ink/62">No donation pledges are stored yet.</p>
              )}
            </div>
          </AdminPanel>
        </div>
      </section>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="paper-panel p-5">
      <div className="flex h-10 w-10 items-center justify-center bg-navy text-paper">{icon}</div>
      <p className="mt-5 text-xs font-semibold uppercase text-brass">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/58">{note}</p>
    </article>
  );
}

function AdminPanel({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="paper-panel p-5 md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center bg-navy text-paper">{icon}</span>
        <h2 className="font-serif text-3xl font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
