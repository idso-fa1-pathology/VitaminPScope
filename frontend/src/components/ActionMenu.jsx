import { useEffect, useRef, useState } from "react";

function ActionMenu({ onOpen, onRename, onDelete, isFolder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          background: "#fff",
          cursor: "pointer",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        ⋯
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "44px",
            right: 0,
            minWidth: "160px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          {!isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onOpen();
              }}
              style={menuItemStyle}
            >
              Open
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename();
            }}
            style={menuItemStyle}
          >
            Rename
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            style={{ ...menuItemStyle, color: "#dc2626" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "none",
  background: "#fff",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
};

export default ActionMenu;