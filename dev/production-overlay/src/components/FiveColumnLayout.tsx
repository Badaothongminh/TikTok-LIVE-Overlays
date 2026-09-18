import type { ReactNode } from "react";

interface FiveColumnLayoutProps {
  likeTotal: number;
  followTotal: number;
  giftTotal: number;
  join: ReactNode;
  like: ReactNode;
  comment: ReactNode;
  gift: ReactNode;
  follow: ReactNode;
}

export function FiveColumnLayout({
  likeTotal,
  followTotal,
  giftTotal,
  join,
  like,
  comment,
  gift,
  follow,
}: FiveColumnLayoutProps) {
  const columns = [
    { icon: "👋", content: join },
    { icon: "❤️", content: like, total: likeTotal },
    { icon: "💬", content: comment },
    { icon: "🪙", content: gift, total: giftTotal },
    { icon: "person", content: follow, total: followTotal },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "789px",
        maxHeight: "calc(100vh - 80px)",
        display: "grid",
        gridTemplateColumns:
          "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.8fr) minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: "16px",
        padding: "40px",
        boxSizing: "border-box",
        background: "rgba(15, 23, 42, 0.72)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        borderRadius: "18px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
        overflow: "hidden",
      }}
    >
      {columns.map(({ icon, content, total }, index) => (
        <div
          key={index}
          style={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              height: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              lineHeight: 1,
              borderBottom: "1px solid rgba(255, 255, 255, 0.22)",
              marginBottom: "14px",
              boxSizing: "border-box",
            }}
          >
            {icon === "person" ? (
              <span
                style={{
                  position: "relative",
                  width: "22px",
                  height: "24px",
                  display: "inline-block",
                  transform: "translateY(-16px)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "7px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "2px",
                    width: "18px",
                    height: "13px",
                    borderRadius: "9px 9px 3px 3px",
                    background: "#22c55e",
                  }}
                />
              </span>
            ) : (
              <span
                style={{
                  display: "inline-block",
                  transform: "translateY(-16px)",
                }}
              >
                {icon}
              </span>
            )}

            {total !== undefined && (
              <span
                style={{
                  display: "inline-block",
                  marginLeft: "8px",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                  transform: "translateY(-16px)",
                }}
              >
                {total}
              </span>
            )}
          </div>

          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              flex: 1,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            {content}
          </div>
        </div>
      ))}
    </div>
  );
}
