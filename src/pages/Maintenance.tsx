export default function Maintenance() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0f172a,#1e293b)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Arial, sans-serif",
        padding: "20px"
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          textAlign: "center",
          background: "rgba(255,255,255,0.05)",
          padding: "50px",
          borderRadius: "20px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 0 30px rgba(0,0,0,.4)"
        }}
      >
        <h1 style={{ fontSize: "70px", marginBottom: "10px" }}>
          🚧
        </h1>

        <h2 style={{ fontSize: "36px", marginBottom: "20px" }}>
          Under Maintenance
        </h2>

        <p
          style={{
            fontSize: "18px",
            color: "#d1d5db",
            lineHeight: "1.7"
          }}
        >
          We're currently improving the platform to serve you better.
          <br />
          Please check back shortly.
        </p>

        <div
          style={{
            marginTop: "35px",
            fontSize: "14px",
            color: "#9ca3af"
          }}
        >
            © 2026 Cheddar4u
        </div>
      </div>
    </div>
  );
}
