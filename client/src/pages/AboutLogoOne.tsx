import logo1Html from "../../../mylogo/logo1.html?raw";

export default function AboutLogoOne() {
  return (
    <div className="fixed inset-0 z-[10000] h-screen w-screen overflow-hidden bg-white">
      <iframe
        title="Logo 01 - Strict Reference"
        srcDoc={logo1Html}
        className="block h-full w-full border-0"
      />
    </div>
  );
}
