import { createFileRoute } from "@tanstack/react-router";
import { notice } from "@/lib/notice";
import { askConfirm } from "@/lib/dialog";
import { Guard } from "@/components/guard";
import { Divider, Empty, RowsSkeleton, Screen, TopBar } from "@/components/kit";
import { fullStamp } from "@/lib/format";
import { usePeople, useRoles, useSetPersonRole, useSetPersonStatus } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People — Staff Access & Roles" },
      { name: "description", content: "Manage your team by approving staff members, adjusting their access and assigning administrator roles." },
      { property: "og:title", content: "People — Staff Access & Roles" },
      { property: "og:description", content: "Manage your team by approving staff members, adjusting their access and assigning administrator roles." },
    ],
  }),
  component: () => (
    <Guard adminOnly>
      <PeoplePage />
    </Guard>
  ),
});

function PeoplePage() {
  const { session } = useAuth();
  const { data = [], isLoading } = usePeople();
  const { data: roles = [] } = useRoles();
  const setStatus = useSetPersonStatus();
  const setRole = useSetPersonRole();

  const roleOf = (id: string) => roles.find((r) => r.user_id === id)?.role ?? "staff";

  const change = async (id: string, status: "approved" | "denied") => {
    if (status === "denied" && !(await askConfirm("deny this person access?", { action: "deny", danger: true })))
      return;
    try {
      await setStatus.mutateAsync({ id, status });
      notice.ok(status === "approved" ? "approved" : "denied");
    } catch (err) {
      notice.from(err, "could not update");
    }
  };

  const assign = async (id: string, role: "admin" | "staff") => {
    try {
      await setRole.mutateAsync({ id, role });
      notice.ok(`now ${role}`);
    } catch (err) {
      notice.from(err, "could not change the role");
    }
  };

  return (
    <Screen>
      <TopBar back title="people" />
      {isLoading ? (
        <RowsSkeleton />
      ) : data.length === 0 ? (
        <Empty text="nobody here yet." />
      ) : (
        data.map((p) => {
          const role = roleOf(p.id);
          const isSelf = p.id === session?.user.id;
          return (
            <div key={p.id}>
              <div className="px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{p.name.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.phone} · {p.status} · {role} · joined {fullStamp(p.joined_at)}
                  </p>
                  {p.device_info ? (
                    <p className="text-xs text-muted-foreground">{p.device_info}</p>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-1">
                  {(["staff", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      disabled={isSelf || setRole.isPending}
                      onClick={() => void assign(p.id, r)}
                      className={`press flex-1 rounded-none border-0 border-b-2 px-3 py-2 text-sm disabled:opacity-40 ${
                        role === r
                          ? "border-foreground bg-secondary text-foreground"
                          : "border-transparent text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  {p.status !== "approved" ? (
                    <button
                      onClick={() => void change(p.id, "approved")}
                      className="press flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm text-primary-foreground"
                    >
                      approve
                    </button>
                  ) : null}
                  {p.status !== "denied" && !isSelf ? (
                    <button
                      onClick={() => void change(p.id, "denied")}
                      className="press flex-1 rounded-lg bg-transparent px-3 py-2.5 text-sm font-semibold text-destructive"
                    >
                      deny
                    </button>
                  ) : null}
                </div>
              </div>
              <Divider />
            </div>
          );
        })
      )}
    </Screen>
  );
}
