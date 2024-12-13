import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

interface DemographicStats {
  ageGroups: {
    '13-17': number;
    '18-24': number;
    '25-34': number;
    '35-44': number;
    '45+': number;
  };
  platforms: {
    Mobile: number;
    Desktop: number;
    Tablet: number;
    Unknown: number;
  };
  locations: {
    [key: string]: number;
  };
}

// Funzione per aggiornare le statistiche demografiche quando un utente completa il setup
export async function updateDemographicStats(userId: string, userData: any) {
  try {
    // Recupera il documento delle statistiche demografiche
    const statsRef = doc(db, 'statistics', 'demographics');
    const statsDoc = await getDoc(statsRef);
    
    // Se non esiste, crealo con valori iniziali
    if (!statsDoc.exists()) {
      await setDoc(statsRef, {
        ageGroups: {
          '13-17': 0,
          '18-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45+': 0
        },
        platforms: {
          Mobile: 0,
          Desktop: 0,
          Tablet: 0,
          Unknown: 0
        },
        locations: {},
        totalUsers: 0
      });
    }

    // Calcola il gruppo d'età dell'utente
    let ageGroup = null;
    if (userData.birthYear) {
      const age = new Date().getFullYear() - parseInt(userData.birthYear);
      if (age >= 13 && age <= 17) ageGroup = '13-17';
      else if (age >= 18 && age <= 24) ageGroup = '18-24';
      else if (age >= 25 && age <= 34) ageGroup = '25-34';
      else if (age >= 35 && age <= 44) ageGroup = '35-44';
      else if (age >= 45) ageGroup = '45+';
    }

    // Prepara l'aggiornamento
    const updateData: any = {
      totalUsers: increment(1)
    };

    // Aggiorna il gruppo d'età
    if (ageGroup) {
      updateData[`ageGroups.${ageGroup}`] = increment(1);
    }

    // Aggiorna la piattaforma
    const platform = userData.platform || 'Unknown';
    updateData[`platforms.${platform}`] = increment(1);

    // Aggiorna la location
    if (userData.country) {
      updateData[`locations.${userData.country}`] = increment(1);
    }

    // Esegui l'aggiornamento
    await updateDoc(statsRef, updateData);

    // Salva anche nel profilo utente per riferimento futuro
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      demographicData: {
        ageGroup,
        platform,
        country: userData.country
      }
    });

  } catch (error) {
    console.error('Errore nell\'aggiornamento delle statistiche demografiche:', error);
  }
}

// Funzione per recuperare le statistiche demografiche formattate
export async function getDemographicStats(): Promise<{
  ageGroups: Array<{ name: string; value: number }>;
  platforms: Array<{ name: string; value: number }>;
  locations: Array<{ name: string; value: number }>;
}> {
  try {
    const statsRef = doc(db, 'statistics', 'demographics');
    const statsDoc = await getDoc(statsRef);
    
    if (!statsDoc.exists()) {
      return {
        ageGroups: [
          { name: '13-17', value: 0 },
          { name: '18-24', value: 0 },
          { name: '25-34', value: 0 },
          { name: '35-44', value: 0 },
          { name: '45+', value: 0 }
        ],
        platforms: [
          { name: 'Mobile', value: 0 },
          { name: 'Desktop', value: 0 },
          { name: 'Tablet', value: 0 }
        ],
        locations: [
          { name: 'Italia', value: 0 },
          { name: 'USA', value: 0 },
          { name: 'UK', value: 0 },
          { name: 'Germania', value: 0 },
          { name: 'Francia', value: 0 }
        ]
      };
    }

    const data = statsDoc.data();
    const totalUsers = data.totalUsers || 1; // Evita divisione per zero

    // Formatta i gruppi d'età
    const ageGroups = Object.entries(data.ageGroups).map(([name, value]) => ({
      name,
      value: Math.round((Number(value) / totalUsers) * 100)
    }));

    // Formatta le piattaforme
    const platforms = Object.entries(data.platforms)
      .filter(([name]) => name !== 'Unknown')
      .map(([name, value]) => ({
        name,
        value: Math.round((Number(value) / totalUsers) * 100)
      }));

    // Formatta le locations
    const locations = Object.entries(data.locations)
      .map(([code, value]) => ({
        name: code === 'IT' ? 'Italia' :
              code === 'US' ? 'USA' :
              code === 'GB' ? 'UK' :
              code === 'DE' ? 'Germania' :
              code === 'FR' ? 'Francia' :
              code === 'ES' ? 'Spagna' :
              code === 'PT' ? 'Portogallo' :
              code === 'NL' ? 'Paesi Bassi' :
              code === 'BE' ? 'Belgio' :
              code === 'CH' ? 'Svizzera' : code,
        value: Math.round((Number(value) / totalUsers) * 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      ageGroups,
      platforms,
      locations
    };
  } catch (error) {
    console.error('Errore nel recupero delle statistiche demografiche:', error);
    return {
      ageGroups: [
        { name: '13-17', value: 0 },
        { name: '18-24', value: 0 },
        { name: '25-34', value: 0 },
        { name: '35-44', value: 0 },
        { name: '45+', value: 0 }
      ],
      platforms: [
        { name: 'Mobile', value: 0 },
        { name: 'Desktop', value: 0 },
        { name: 'Tablet', value: 0 }
      ],
      locations: [
        { name: 'Italia', value: 0 },
        { name: 'USA', value: 0 },
        { name: 'UK', value: 0 },
        { name: 'Germania', value: 0 },
        { name: 'Francia', value: 0 }
      ]
    };
  }
}
