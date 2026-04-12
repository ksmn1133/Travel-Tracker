import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TravelSegment } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = 'travelSegments';
const USERS_COLLECTION = 'users';

export const travelService = {
  async syncUser(user: any) {
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const path = `${USERS_COLLECTION}/${user.uid}`;
    
    try {
      const userDoc = await getDoc(userRef);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString(),
        role: user.email === 'xiaoxia3691158@gmail.com' ? 'admin' : 'user'
      };

      if (!userDoc.exists()) {
        await setDoc(userRef, userData);
      } else {
        await updateDoc(userRef, userData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async addSegment(segment: Omit<TravelSegment, 'id' | 'userId' | 'createdAt'>) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const path = COLLECTION_NAME;
    try {
      const docRef = await addDoc(collection(db, path), {
        ...segment,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  subscribeToSegments(callback: (segments: TravelSegment[]) => void) {
    if (!auth.currentUser) return () => {};
    
    const path = COLLECTION_NAME;
    const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
    
    return onSnapshot(q, (snapshot) => {
      const segments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TravelSegment[];
      callback(segments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async deleteSegment(id: string) {
    const path = `${COLLECTION_NAME}/${id}`;
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async updateSegment(id: string, segment: Partial<Omit<TravelSegment, 'id' | 'userId' | 'createdAt'>>) {
    const path = `${COLLECTION_NAME}/${id}`;
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), segment);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToAllSegments(callback: (segments: TravelSegment[]) => void) {
    const path = COLLECTION_NAME;
    return onSnapshot(collection(db, path), (snapshot) => {
      const segments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TravelSegment[];
      callback(segments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToUsers(callback: (users: any[]) => void) {
    const path = USERS_COLLECTION;
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
};
