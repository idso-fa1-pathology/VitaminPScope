import { Routes, Route } from "react-router-dom";
import SlideManagerPage from "./pages/SlideManagerPage";
import ViewerPage from "./pages/ViewerPage";
import MultiViewerPage from "./pages/MultiViewerPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<SlideManagerPage />} />
      <Route path="/viewer/:slideName" element={<ViewerPage />} />
      <Route path="/compare" element={<MultiViewerPage />} />
    </Routes>
  );
}

export default App;