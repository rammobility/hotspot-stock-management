import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StockHeaderProps {
  title: string;
  showBack?: boolean;
}

const StockHeader = ({ title, showBack = true }: StockHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="fixed-top bg-white shadow-sm d-flex align-items-center px-4 py-2">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <div style={{ width: '40px', visibility: showBack ? 'visible' : 'hidden' }}>
          <button 
            className="btn-back"
            onClick={() => navigate('/')}
            title="Back to home"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <img 
          src="/logo.svg" 
          alt="Logo" 
          className="logo"
          style={{ height: '40px', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        />
        <div style={{ width: '40px' }}></div>
      </div>
    </header>
  );
};

export default StockHeader;