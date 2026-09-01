import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const swalTheme = {
  background: "#12121b",
  color: "#f3f4f8",
  confirmButtonColor: "#7c5cff",
};

const api = axios.create({ baseURL: "http://localhost:5000" });

function App() {
  const [currentView, setCurrentView] = useState("USER");

  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem("adminToken") || null,
  );

  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Hardware");
  const [priority, setPriority] = useState("NORMAL");
  const [reporter, setReporter] = useState("");
  const [image, setImage] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");

  const API_URL = "/api/tickets";

  const fetchTickets = async () => {
    try {
      const response = await api.get(API_URL);
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    }
  };

  const logout = (message) => {
    localStorage.removeItem("adminToken");
    setAdminToken(null);
    setCurrentView("USER");
    if (message) {
      Swal.fire({
        icon: "info",
        title: message,
        ...swalTheme,
        timer: 1800,
        showConfirmButton: false,
      });
    }
  };

  useEffect(() => {
    if (adminToken) {
      api.defaults.headers.common.Authorization = `Bearer ${adminToken}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }

    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && adminToken) {
          logout("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        }
        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [adminToken]);

  useEffect(() => {
    fetchTickets();
    socket.on("ticketUpdate", () => {
      fetchTickets();
    });
    return () => {
      socket.off("ticketUpdate");
    };
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!title || !description || !reporter) {
      Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกข้อมูลให้ครบทุกช่องก่อนส่งคำขอ",
        ...swalTheme,
        confirmButtonColor: "#f59e0b",
      });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("priority", priority);
      formData.append("reporter", reporter);
      if (image) formData.append("image", image);

      await api.post(API_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire({
        icon: "success",
        title: "ส่งเรื่องแจ้งซ่อมสำเร็จ",
        text: "ระบบได้บันทึกคำขอของคุณเรียบร้อยแล้ว",
        ...swalTheme,
        showConfirmButton: false,
        timer: 1500,
      });

      setTitle("");
      setDescription("");
      setCategory("Hardware");
      setPriority("NORMAL");
      setReporter("");
      setImage(null);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: error.response?.data?.error || "กรุณาลองใหม่อีกครั้ง",
        ...swalTheme,
        confirmButtonColor: "#f43155",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/api/auth/login", {
        username: adminUser,
        password: adminPass,
      });

      localStorage.setItem("adminToken", response.data.token);
      setAdminToken(response.data.token);
      setCurrentView("ADMIN_DASHBOARD");
      setAdminUser("");
      setAdminPass("");
      Swal.fire({
        icon: "success",
        title: "เข้าสู่ระบบสำเร็จ",
        text: "ยินดีต้อนรับสู่ IT Admin Command Center",
        ...swalTheme,
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "เข้าสู่ระบบไม่สำเร็จ",
        text:
          error.response?.data?.error || "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
        ...swalTheme,
        confirmButtonColor: "#f43155",
      });
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`${API_URL}/${id}/status`, { status: newStatus });
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error(error);
      }
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: `ยืนยันการลบ Ticket #${id}?`,
      text: "ข้อมูลนี้จะถูกลบออกจากระบบถาวร",
      icon: "warning",
      ...swalTheme,
      showCancelButton: true,
      confirmButtonColor: "#f43155",
      cancelButtonColor: "#2d2d3d",
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`${API_URL}/${id}`);
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error(error);
        }
      }
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.reporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === "ALL" || ticket.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalTickets = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const completedCount = tickets.filter((t) => t.status === "COMPLETED").length;

  const statusLabel = (s) =>
    s === "PENDING"
      ? "รอดำเนินการ"
      : s === "IN_PROGRESS"
        ? "กำลังซ่อม"
        : "เสร็จสิ้น";

  const statusBadgeClass = (s) =>
    s === "COMPLETED"
      ? "badge-status badge-status--done"
      : s === "IN_PROGRESS"
        ? "badge-status badge-status--progress"
        : "badge-status badge-status--pending";

  const priorityBadgeClass = (p) =>
    p === "CRITICAL"
      ? "badge-status badge-status--critical"
      : p === "URGENT"
        ? "badge-status badge-status--urgent"
        : "badge-status badge-status--normal";

  const renderTicketRow = (ticket, withActions) => (
    <tr key={ticket.id}>
      <td className="mono-id">#{ticket.id}</td>
      <td>
        {ticket.image ? (
          <a
            href={`http://localhost:5000${ticket.image}`}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="thumb"
              src={`http://localhost:5000${ticket.image}`}
              alt="หลักฐานปัญหา"
            />
          </a>
        ) : (
          <span className="small" style={{ color: "#9294ab" }}>
            ไม่มีภาพ
          </span>
        )}
      </td>
      <td>
        <div className="fw-bold" style={{ color: "#f3f4f8" }}>
          {ticket.title}
        </div>
        <div
          className="small text-truncate"
          style={{ maxWidth: "240px", color: "#9294ab" }}
        >
          {ticket.description}
        </div>
      </td>
      <td style={{ color: "#c7c9d9" }}>{ticket.reporter}</td>
      <td>
        <span className="badge-status badge-status--neutral">
          {ticket.category}
        </span>
      </td>
      <td>
        <span className={priorityBadgeClass(ticket.priority)}>
          {ticket.priority}
        </span>
      </td>
      {withActions ? (
        <>
          <td>
            <select
              className="status-select"
              style={{
                background:
                  ticket.status === "COMPLETED"
                    ? "#16a34a"
                    : ticket.status === "IN_PROGRESS"
                      ? "#f59e0b"
                      : "#3f3f52",
                color: ticket.status === "IN_PROGRESS" ? "#1c1300" : "#fff",
              }}
              value={ticket.status}
              onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
            >
              <option value="PENDING">รอดำเนินการ</option>
              <option value="IN_PROGRESS">กำลังซ่อม</option>
              <option value="COMPLETED">เสร็จสิ้น</option>
            </select>
          </td>
          <td className="text-center">
            <button
              className="btn-ghost-danger"
              onClick={() => handleDelete(ticket.id)}
            >
              ลบ
            </button>
          </td>
        </>
      ) : (
        <td>
          <span className={statusBadgeClass(ticket.status)}>
            {statusLabel(ticket.status)}
          </span>
        </td>
      )}
    </tr>
  );

  return (
    <div className="app-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

        :root{
          --bg:#08080d;
          --surface: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.09);
          --text: #f3f4f8;
          --text-dim: #9294ab;
          --accent-from:#6d5bff;
          --accent-to:#a855f7;
        }

        @keyframes fadeInUp{ from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:translateY(0);} }
        @keyframes orbDrift{ 0%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(26px,-22px) scale(1.07);} 100%{ transform:translate(0,0) scale(1);} }
        @keyframes pulseDot{ 0%,100%{ box-shadow:0 0 0 0 rgba(245,158,11,0.55);} 50%{ box-shadow:0 0 0 6px rgba(245,158,11,0); } }
        @keyframes spin{ to{ transform:rotate(360deg);} }

        *{ box-sizing:border-box; }
        *:focus-visible{ outline:2px solid var(--accent-from); outline-offset:2px; }

        .app-shell{
          position:relative;
          min-height:100vh;
          background:var(--bg);
          color:var(--text);
          font-family:'Sarabun', sans-serif;
          overflow-x:hidden;
          padding:32px 16px 0;
        }

        .bg-orb{ position:fixed; border-radius:50%; filter:blur(95px); pointer-events:none; z-index:0; animation:orbDrift 24s ease-in-out infinite; }
        .bg-orb--a{ width:460px; height:460px; top:-150px; left:-120px; background:radial-gradient(circle, rgba(109,91,255,0.38), transparent 70%); }
        .bg-orb--b{ width:520px; height:520px; bottom:-220px; right:-160px; background:radial-gradient(circle, rgba(168,85,247,0.28), transparent 70%); animation-delay:-9s; }
        .bg-grid{ position:fixed; inset:0; background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size:26px 26px; -webkit-mask-image:radial-gradient(ellipse at top, black, transparent 78%); mask-image:radial-gradient(ellipse at top, black, transparent 78%); pointer-events:none; z-index:0; }

        .shell-inner{ position:relative; z-index:1; max-width:1150px; margin:0 auto; padding-bottom:40px; }

        .glass-nav{ background:var(--surface); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid var(--border); border-radius:20px; padding:14px 18px; }
        .brand-mark{ width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg,var(--accent-from),var(--accent-to)); display:flex; align-items:center; justify-content:center; font-weight:800; color:#fff; box-shadow:0 6px 18px rgba(109,91,255,0.4); font-size:1.05rem; }
        .brand-name{ font-weight:700; color:#fff; line-height:1.1; }
        .brand-sub{ font-size:.72rem; color:var(--text-dim); letter-spacing:.02em; }

        .segmented{ background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:999px; padding:4px; display:inline-flex; gap:4px; }
        .segmented-btn{ border:none; background:transparent; color:var(--text-dim); padding:9px 18px; border-radius:999px; font-weight:600; font-size:.85rem; transition:transform .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease; cursor:pointer; white-space:nowrap; }
        .segmented-btn.is-active{ background:linear-gradient(135deg,var(--accent-from),var(--accent-to)); color:#fff; box-shadow:0 6px 16px rgba(109,91,255,0.38); transform:scale(1.03); }
        .segmented-btn:not(.is-active):hover{ color:#fff; background:rgba(255,255,255,0.07); }

        .btn-ghost-danger{ background:transparent; border:1px solid rgba(244,49,85,0.4); color:#fca5b5; padding:8px 16px; border-radius:999px; font-weight:600; font-size:.82rem; transition:background .2s ease, border-color .2s ease; cursor:pointer; }
        .btn-ghost-danger:hover{ background:rgba(244,49,85,0.14); border-color:#f87171; }

        .panel{ background:var(--surface); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid var(--border); border-radius:20px; transition:border-color .25s ease; }
        .panel:hover{ border-color:rgba(255,255,255,0.15); }

        .eyebrow{ display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:999px; font-size:.8rem; font-weight:600; margin-bottom:10px; }
        .eyebrow--user{ background:rgba(109,91,255,0.14); color:#b4a9ff; border:1px solid rgba(109,91,255,0.32); }
        .eyebrow--admin{ background:rgba(244,49,85,0.12); color:#fca5b5; border:1px solid rgba(244,49,85,0.3); }

        .field-label{ font-size:.8rem; font-weight:600; color:var(--text-dim); margin-bottom:6px; display:block; }
        .field-input{ width:100%; background:rgba(255,255,255,0.025); border:1px solid var(--border); color:var(--text); border-radius:12px; padding:10px 14px; font-size:.92rem; transition:border-color .2s ease, box-shadow .2s ease; outline:none; }
        .field-input::placeholder{ color:#686b80; }
        .field-input:focus{ border-color:var(--accent-from); box-shadow:0 0 0 3px rgba(109,91,255,0.2); }
        select.field-input option{ background:#14141f; color:#fff; }

        .btn-primary-grad{ background:linear-gradient(135deg,var(--accent-from),var(--accent-to)); border:none; color:#fff; font-weight:700; padding:12px 20px; border-radius:12px; transition:transform .2s ease, box-shadow .2s ease; box-shadow:0 10px 26px rgba(109,91,255,0.28); cursor:pointer; }
        .btn-primary-grad:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 14px 32px rgba(109,91,255,0.42); }
        .btn-primary-grad:disabled{ opacity:.6; cursor:not-allowed; transform:none; }

        .stat-card{ position:relative; overflow:hidden; padding:16px 18px; }
        .stat-num{ font-family:'JetBrains Mono', monospace; font-weight:700; font-size:1.7rem; }
        .dot-pulse{ width:8px; height:8px; border-radius:50%; background:#f59e0b; display:inline-block; animation:pulseDot 1.8s infinite; margin-left:6px; }

        .table-wrap{ overflow-x:auto; }
        .table-modern{ width:100%; border-collapse:separate; border-spacing:0; }
        .table-modern th{ text-align:left; font-size:.78rem; color:var(--text-dim); font-weight:600; padding:12px 14px; border-bottom:1px solid var(--border); white-space:nowrap; }
        .table-modern td{ padding:14px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:.88rem; vertical-align:middle; }
        .table-modern tbody tr{ transition:background .2s ease; }
        .table-modern tbody tr:hover{ background:rgba(255,255,255,0.03); }

        .mono-id{ font-family:'JetBrains Mono', monospace; color:#c4b5fd; font-weight:600; }

        .status-select{ border:none; border-radius:10px; padding:7px 10px; font-weight:600; font-size:.82rem; transition:filter .2s ease; cursor:pointer; }
        .status-select:hover{ filter:brightness(1.12); }

        .badge-status{ display:inline-flex; align-items:center; padding:5px 12px; border-radius:999px; font-size:.78rem; font-weight:600; }
        .badge-status--neutral{ background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#d3d4e4; }
        .badge-status--normal{ background:rgba(56,189,248,0.14); color:#7dd3fc; border:1px solid rgba(56,189,248,0.3); }
        .badge-status--urgent{ background:rgba(245,158,11,0.16); color:#fbbf24; border:1px solid rgba(245,158,11,0.32); }
        .badge-status--critical{ background:rgba(244,49,85,0.16); color:#fb7185; border:1px solid rgba(244,49,85,0.32); }
        .badge-status--pending{ background:rgba(255,255,255,0.07); color:#d3d4e4; border:1px solid var(--border); }
        .badge-status--progress{ background:rgba(245,158,11,0.16); color:#fbbf24; border:1px solid rgba(245,158,11,0.32); }
        .badge-status--done{ background:rgba(34,197,94,0.16); color:#4ade80; border:1px solid rgba(34,197,94,0.32); }

        .thumb{ width:42px; height:42px; border-radius:8px; object-fit:cover; border:1px solid var(--border); transition:transform .2s ease; display:block; }
        .thumb:hover{ transform:scale(1.8); position:relative; z-index:5; box-shadow:0 10px 26px rgba(0,0,0,0.55); }

        .spinner{ width:13px; height:13px; border-radius:50%; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; display:inline-block; animation:spin .7s linear infinite; margin-right:8px; vertical-align:-2px; }

        .view-fade{ animation:fadeInUp .45s ease both; }

        .empty-state{ text-align:center; padding:44px 12px; color:var(--text-dim); }

        .app-footer{ text-align:center; padding:28px 0 32px; font-size:.82rem; color:var(--text-dim); border-top:1px solid var(--border); margin-top:36px; }

        @media (prefers-reduced-motion: reduce){
          .bg-orb, .view-fade, .dot-pulse, .spinner{ animation:none !important; }
          .btn-primary-grad:hover, .thumb:hover, .segmented-btn{ transform:none !important; }
        }
      `}</style>

      <div className="bg-grid" />
      <div className="bg-orb bg-orb--a" />
      <div className="bg-orb bg-orb--b" />

      <div className="shell-inner">
        <div className="glass-nav d-flex justify-content-between align-items-center flex-wrap gap-3 mb-5">
          <div className="d-flex align-items-center gap-2">
            <div
              className="brand-mark"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                overflow: "hidden",
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="100"
                  height="100"
                  rx="28"
                  fill="url(#paint0_linear)"
                />
                <path
                  d="M65 31C65 22.7157 58.2843 16 50 16H35C26.7157 16 20 22.7157 20 31C20 39.2843 26.7157 46 35 46H65C73.2843 46 80 52.7157 80 61C80 69.2843 73.2843 76 65 76H50C41.7157 76 35 69.2843 35 61"
                  stroke="white"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <circle cx="65" cy="31" r="5" fill="#A78BFA" />
                <circle cx="35" cy="61" r="5" fill="#A78BFA" />
                <defs>
                  <linearGradient
                    id="paint0_linear"
                    x1="0"
                    y1="0"
                    x2="100"
                    y2="100"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#7C3AED" />
                    <stop offset="1" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <div className="brand-name">SyncIT Support Hub</div>
              <div className="brand-sub">ศูนย์บริการแจ้งซ่อมไอที</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="segmented">
              <button
                className={`segmented-btn ${currentView === "USER" ? "is-active" : ""}`}
                onClick={() => setCurrentView("USER")}
              >
                หน้าแจ้งซ่อม
              </button>
              <button
                className={`segmented-btn ${currentView === "ADMIN_LOGIN" || currentView === "ADMIN_DASHBOARD" ? "is-active" : ""}`}
                onClick={() => {
                  if (currentView === "ADMIN_DASHBOARD") return;
                  setCurrentView(
                    adminToken ? "ADMIN_DASHBOARD" : "ADMIN_LOGIN",
                  );
                }}
              >
                ผู้ดูแลระบบ
              </button>
            </div>
            {currentView === "ADMIN_DASHBOARD" && (
              <button className="btn-ghost-danger" onClick={() => logout()}>
                ออกจากระบบ
              </button>
            )}
          </div>
        </div>

        {currentView === "USER" && (
          <div className="view-fade" key="user-view">
            <div className="text-center mb-5">
              <span className="eyebrow eyebrow--user">ผู้ใช้งานทั่วไป</span>
              <h1 className="fw-bold mb-2" style={{ color: "#fff" }}>
                ระบบแจ้งปัญหาและขอความช่วยเหลือด้าน IT
              </h1>
              <p className="m-0" style={{ color: "#c7c9d9" }}>
                กรอกแบบฟอร์มด้านล่างเพื่อแจ้งเคสปัญหาคอมพิวเตอร์หรืออุปกรณ์ไอทีใหม่อย่างรวดเร็ว
              </p>
            </div>

            <div className="panel p-4 mb-4">
              <h5 className="fw-bold mb-4" style={{ color: "#fff" }}>
                แบบฟอร์มแจ้งปัญหาอุปกรณ์
              </h5>
              <form onSubmit={handleCreateTicket} className="row g-3">
                <div className="col-md-6">
                  <label className="field-label">หัวข้อปัญหา</label>
                  <input
                    type="text"
                    className="field-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น หน้าจอไม่ติด, เชื่อมต่อ Wi-Fi ไม่ได้"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="field-label">ชื่อผู้แจ้ง</label>
                  <input
                    type="text"
                    className="field-input"
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    placeholder="ระบุชื่อ-นามสกุลของคุณ"
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="field-label">หมวดหมู่</label>
                  <select
                    className="field-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Network">Network</option>
                    <option value="Printer">Printer</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="field-label">ความเร่งด่วน</label>
                  <select
                    className="field-input"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="NORMAL">Normal (ปกติ)</option>
                    <option value="URGENT">Urgent (ด่วน)</option>
                    <option value="CRITICAL">Critical (วิกฤต)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="field-label">แนบรูปภาพหลักฐาน</label>
                  <input
                    type="file"
                    className="field-input"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files[0])}
                  />
                </div>
                <div className="col-md-12">
                  <label className="field-label">รายละเอียดอาการเสีย</label>
                  <textarea
                    className="field-input"
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="อธิบายอาการเบื้องต้น เพื่อให้ช่างวิเคราะห์ปัญหาได้ง่ายขึ้น..."
                    required
                  ></textarea>
                </div>
                <div className="col-md-12">
                  <button
                    type="submit"
                    className="btn-primary-grad w-100"
                    disabled={loading}
                  >
                    {loading && <span className="spinner" />}
                    {loading ? "กำลังส่งข้อมูล..." : "ส่งคำขอแจ้งซ่อม"}
                  </button>
                </div>
              </form>
            </div>

            <div className="panel p-4">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <h5 className="fw-bold m-0" style={{ color: "#fff" }}>
                  ติดตามสถานะเคสทั้งหมดในระบบ
                </h5>
                <div style={{ width: "250px" }}>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="ค้นหาหัวข้อ หรือผู้แจ้ง..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>หลักฐาน</th>
                      <th>หัวข้อปัญหา / รายละเอียด</th>
                      <th>ผู้แจ้ง</th>
                      <th>หมวดหมู่</th>
                      <th>ความเร่งด่วน</th>
                      <th>สถานะปัจจุบัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan="7">
                          <div className="empty-state">
                            ยังไม่มีเคสที่ตรงกับเงื่อนไขนี้
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((ticket) =>
                        renderTicketRow(ticket, false),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentView === "ADMIN_LOGIN" && (
          <div
            className="view-fade row justify-content-center my-5"
            key="login-view"
          >
            <div className="col-md-5">
              <div className="panel p-4">
                <div className="text-center mb-4">
                  <div className="brand-mark mx-auto mb-3">S</div>
                  <h3 className="fw-bold" style={{ color: "#fff" }}>
                    เข้าสู่ระบบผู้ดูแล
                  </h3>
                  <p className="small m-0" style={{ color: "var(--text-dim)" }}>
                    กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ
                  </p>
                </div>
                <form
                  onSubmit={handleAdminLogin}
                  className="d-flex flex-column gap-3"
                >
                  <div>
                    <label className="field-label">Username</label>
                    <input
                      type="text"
                      className="field-input"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      placeholder="ชื่อผู้ใช้ผู้ดูแลระบบ"
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label">Password</label>
                    <input
                      type="password"
                      className="field-input"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="รหัสผ่าน"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary-grad mt-2">
                    เข้าสู่ระบบหลังบ้าน
                  </button>
                  <div
                    className="text-center small mt-2"
                    style={{ color: "var(--text-dim)" }}
                  >
                    บัญชีผู้ดูแลระบบตั้งค่าไว้ในไฟล์ .env ของฝั่งเซิร์ฟเวอร์
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {currentView === "ADMIN_DASHBOARD" && (
          <div className="view-fade" key="admin-view">
            <div className="mb-4">
              <span className="eyebrow eyebrow--admin">
                Admin Control Center
              </span>
              <h1 className="fw-bold mb-1" style={{ color: "#fff" }}>
                ระบบจัดการเคสหลังบ้าน
              </h1>
              <p className="m-0" style={{ color: "#c7c9d9" }}>
                จัดการสถานะเคสปัญหา เปลี่ยนแปลงข้อมูล และลบรายการที่ไม่จำเป็น
              </p>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-3 col-6">
                <div className="panel stat-card">
                  <div
                    className="small mb-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Ticket ทั้งหมด
                  </div>
                  <div className="stat-num" style={{ color: "#fff" }}>
                    {totalTickets}
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="panel stat-card">
                  <div
                    className="small mb-1 d-flex align-items-center"
                    style={{ color: "#fbbf24" }}
                  >
                    รอดำเนินการ
                    {pendingCount > 0 && <span className="dot-pulse" />}
                  </div>
                  <div className="stat-num" style={{ color: "#fbbf24" }}>
                    {pendingCount}
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="panel stat-card">
                  <div className="small mb-1" style={{ color: "#7dd3fc" }}>
                    กำลังซ่อม
                  </div>
                  <div className="stat-num" style={{ color: "#7dd3fc" }}>
                    {inProgressCount}
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="panel stat-card">
                  <div className="small mb-1" style={{ color: "#4ade80" }}>
                    เสร็จสิ้น
                  </div>
                  <div className="stat-num" style={{ color: "#4ade80" }}>
                    {completedCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel p-4">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <h5 className="fw-bold m-0" style={{ color: "#fff" }}>
                  จัดการรายการ Ticket ทั้งหมด
                </h5>
                <div className="d-flex gap-2 flex-wrap">
                  <select
                    className="field-input"
                    style={{ width: "160px" }}
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="ALL">หมวดหมู่ทั้งหมด</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Network">Network</option>
                    <option value="Printer">Printer</option>
                  </select>
                  <div style={{ width: "220px" }}>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="ค้นหาหัวข้อ หรือผู้แจ้ง..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>หลักฐาน</th>
                      <th>หัวข้อปัญหา / รายละเอียด</th>
                      <th>ผู้แจ้ง</th>
                      <th>หมวดหมู่</th>
                      <th>ความเร่งด่วน</th>
                      <th>สถานะปัจจุบัน</th>
                      <th>เปลี่ยนสถานะ</th>
                      <th className="text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan="9">
                          <div className="empty-state">
                            ยังไม่มีเคสที่ตรงกับเงื่อนไขนี้
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((ticket) =>
                        renderTicketRow(ticket, true),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center py-4 mt-5 border-top border-secondary border-opacity-10" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        <div className="fw-semibold text-white mb-1">SyncIT Support Hub &bull; Full-Stack Portfolio Project</div>
        <div className="mb-2">Developed by Weerapat Pona & Akkaradetch Phongsamang (Nakhon Pathom Vocational College)</div>
        <div className="small" style={{ fontSize: '0.78rem', color: '#7c7f96' }}>
          Built with React &bull; Vite &bull; Node.js &bull; Express &bull; Prisma &bull; MySQL &bull; Socket.io
        </div>
      </footer>
    </div>
  );
}

export default App;