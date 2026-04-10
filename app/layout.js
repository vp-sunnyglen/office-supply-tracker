export const metadata = {
  title: "Office Supply Tracker",
  description: "Sunnyglen.org Office Supply Tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#f1f5f9" }}>
        {children}
      </body>
    </html>
  );
}
