import { Routes, Route } from "react-router-dom";
import SlideManagerPage from "./pages/SlideManagerPage";
import ViewerPage from "./pages/ViewerPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<SlideManagerPage />} />
      <Route path="/viewer/:slideName" element={<ViewerPage />} />
    </Routes>
  );
}

export default App;