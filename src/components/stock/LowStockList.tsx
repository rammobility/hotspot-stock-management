import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../utils/firebase';

interface StockItem {
  id: string;
  categoryName: string;
  data: {
    itemName: string;
    unit: string;
    minStock: number;
  };
  currentStock: number;
  lastUpdated: Date;
}

const LowStockList = () => {
  const navigate = useNavigate();
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const categoriesRef = collection(db, 'masterStock');
        const categoriesSnap = await getDocs(categoriesRef);
        const stockData: StockItem[] = [];
        
        for (const categoryDoc of categoriesSnap.docs) {
          const categoryName = categoryDoc.id;
          const itemsRef = collection(db, `masterStock/${categoryName}/items`);
          const itemsSnap = await getDocs(itemsRef);
          
          itemsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.currentStock <= data.data.minStock) {
              stockData.push({
                id: doc.id,
                categoryName: categoryName,
                data: {
                  itemName: data.data.itemName,
                  unit: data.data.unit,
                  minStock: data.data.minStock
                },
                currentStock: data.currentStock || 0,
                lastUpdated: data.lastUpdated?.toDate() || new Date()
              });
            }
          });
        }

        // Sort by currentStock/minStock ratio
        const sortedData = stockData.sort((a, b) => 
          (a.currentStock / a.data.minStock) - (b.currentStock / b.data.minStock)
        );
        
        setLowStockItems(sortedData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Low Stock Items</h5>
              <button 
                className="btn-back"
                onClick={() => navigate('/')}
                title="Back to home"
              >
                <ArrowLeft size={20} />
              </button>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="mb-0">{item.data.itemName}</h6>
                          <small className="text-muted">{item.categoryName}</small>
                        </div>
                        <div className="text-end">
                          <div className="mb-0">
                            <strong>{item.currentStock}</strong> {item.data.unit}
                            {item.currentStock <= item.data.minStock && (
                              <AlertTriangle className="text-warning ms-1" size={16} />
                            )}
                          </div>
                          <small className="text-muted">
                            Min: {item.data.minStock} {item.data.unit}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && (
                    <div className="text-center text-muted py-3">
                      No items below minimum stock level
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LowStockList;