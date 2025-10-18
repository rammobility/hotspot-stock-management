import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    console.log('Database instance:', db);
    
    // Try to get a simple collection
    const testRef = collection(db, 'masterStock');
    console.log('Collection reference created:', testRef);
    
    const snapshot = await getDocs(testRef);
    console.log('Query executed successfully');
    console.log('Number of documents:', snapshot.size);
    
    snapshot.forEach((doc) => {
      console.log('Document ID:', doc.id);
      console.log('Document data:', doc.data());
    });
    
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return { success: false, error };
  }
};