
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StockHome from './components/stock/StockHome';
import AddStock from './components/stock/AddStock';
import UpdateStock from './components/stock/UpdateStock';
import StockReport from './components/stock/StockReport';
import LowStockList from './components/stock/LowStockList';

function App() {
  return (
    <Router>
      <div className="main-page-wrapper">
        <Routes>
          <Route path="/" element={<StockHome />} />
          <Route path="/add-stock" element={<AddStock />} />
          <Route path="/update-stock" element={<UpdateStock />} />
          <Route path="/stock-report" element={<StockReport />} />
          <Route path="/low-stock" element={<LowStockList />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
