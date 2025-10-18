import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Plus, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../utils/firebase';
import StockHeader from './StockHeader';

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

interface RecentEntry {
  id: string;
  itemName: string;
  type: 'purchase' | 'update';
  quantity: number;
  date: Date;
}

const StockHome = () => {
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
    try {
        // Fetch categories first
        const categoriesRef = collection(db, 'masterStock');
        const categoriesSnap = await getDocs(categoriesRef);
        const stockData: StockItem[] = [];
        
        // For each category, fetch items
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

        // Sort by currentStock/minStock ratio to show most critical items first
        const sortedData = stockData.sort((a, b) => 
          (a.currentStock / a.data.minStock) - (b.currentStock / b.data.minStock)
        );
        
        setLowStockItems(sortedData);

        // Fetch recent entries
        const entriesRef = collection(db, 'purchases');
        const q = query(entriesRef, orderBy('date', 'desc'), limit(5));
        const entriesSnap = await getDocs(q);
        const entriesData: RecentEntry[] = [];

        entriesSnap.forEach((doc) => {
          const data = doc.data();
          entriesData.push({
            id: doc.id,
            itemName: data.itemName,
            type: data.type,
            quantity: data.quantity,
            date: data.date.toDate()
          });
        });

        setRecentEntries(entriesData);
        
        // Set last updated time
        if (entriesData.length > 0) {
          setLastUpdated(entriesData[0].date);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  return (
    <>
      <StockHeader title="Stock Management" showBack={false} />
      <div className="container" style={{ marginTop: '80px' }}>
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
          {/* Stock Summary Card */}
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted d-flex justify-content-between align-items-center">
                Low Stock Items
                {loading && (
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                )}
              </h6>
              <div className="list-group list-group-flush">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="list-group-item px-0">
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
                {lowStockItems.length > 5 && (
                  <div className="text-center mt-3">
                    <Link to="/low-stock" className="btn btn-outline-primary btn-sm">
                      Show All {lowStockItems.length} Low Stock Items
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="d-grid gap-4 mb-4">
            <Link to="/add-stock" className="btn btn-primary btn-lg rounded-pill d-flex align-items-center justify-content-center">
              <Plus className="me-2" size={24} />
              Add Stock
            </Link>
            <Link to="/update-stock" className="btn btn-secondary btn-lg rounded-pill d-flex align-items-center justify-content-center">
              <RefreshCw className="me-2" size={24} />
              Update Stock
            </Link>
            <Link to="/stock-report" className="btn btn-info btn-lg rounded-pill d-flex align-items-center justify-content-center">
              <Clock className="me-2" size={24} />
              Stock Report
            </Link>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-center text-muted">
              <small>
                <Clock size={14} className="me-1" />
                Last updated: {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
              </small>
            </div>
          )}

          {/* Recent Entries FAB */}
          <button
            className="btn btn-primary rounded-circle position-fixed d-flex align-items-center justify-content-center"
            style={{ 
              bottom: '2rem', 
              right: '2rem', 
              width: '56px', 
              height: '56px',
              padding: 0,
              lineHeight: 1
            }}
            onClick={() => setShowRecent(!showRecent)}
          >
            <Clock size={24} style={{ margin: 'auto' }} />
          </button>

          {/* Recent Entries Modal */}
          {showRecent && (
            <div className="position-fixed bottom-0 end-0 mb-5 me-5">
              <div className="card" style={{ width: '300px' }}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Recent Entries</h6>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowRecent(false)}
                  ></button>
                </div>
                <div className="card-body">
                  {recentEntries.map((entry) => (
                    <div key={entry.id} className="mb-2">
                      <small>
                        {entry.itemName} - {entry.quantity}
                        <br />
                        <span className="text-muted">
                          {entry.type} • {entry.date.toLocaleDateString()}
                        </span>
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default StockHome;