import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Service } from '../types/service';
import { Review, ServiceMetrics, ServiceMatch } from '../types/review';
import { getDemographicStats } from './demographics';

// Calcola la distanza tra due punti usando la formula di Haversine
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calcola il punteggio di corrispondenza delle competenze
function calculateSkillsMatch(requiredSkills: string[], providerSkills: string[]): number {
  if (!requiredSkills.length) return 100;
  const matches = requiredSkills.filter(skill => 
    providerSkills.some(s => s.toLowerCase() === skill.toLowerCase())
  );
  return (matches.length / requiredSkills.length) * 100;
}

// Recupera le metriche di servizio per un utente
export async function getServiceMetrics(userId: string): Promise<ServiceMetrics> {
  const reviewsRef = collection(db, 'reviews');
  const q = query(reviewsRef, where('providerId', '==', userId));
  const reviewsSnapshot = await getDocs(q);
  const reviews = reviewsSnapshot.docs.map(doc => doc.data() as Review);

  if (!reviews.length) {
    return {
      averageRating: 0,
      totalReviews: 0,
      metrics: {
        communication: 0,
        quality: 0,
        timeliness: 0,
        value: 0
      }
    };
  }

  const totalMetrics = reviews.reduce((acc, review) => ({
    rating: acc.rating + review.rating,
    communication: acc.communication + review.metrics.communication,
    quality: acc.quality + review.metrics.quality,
    timeliness: acc.timeliness + review.metrics.timeliness,
    value: acc.value + review.metrics.value
  }), { rating: 0, communication: 0, quality: 0, timeliness: 0, value: 0 });

  return {
    averageRating: totalMetrics.rating / reviews.length,
    totalReviews: reviews.length,
    metrics: {
      communication: totalMetrics.communication / reviews.length,
      quality: totalMetrics.quality / reviews.length,
      timeliness: totalMetrics.timeliness / reviews.length,
      value: totalMetrics.value / reviews.length
    }
  };
}

// Trova servizi corrispondenti per un servizio richiesto
export async function findMatchingServices(requestedService: Service): Promise<ServiceMatch[]> {
  const servicesRef = collection(db, 'services');
  const q = query(
    servicesRef,
    where('type', '==', 'offered'),
    where('category', '==', requestedService.category),
    where('availability.status', '==', 'active')
  );

  const servicesSnapshot = await getDocs(q);
  const matchPromises = servicesSnapshot.docs.map(async (serviceDoc) => {
    const service = serviceDoc.data() as Service;
    const providerDoc = await getDoc(doc(db, 'users', service.userId));
    const provider = providerDoc.data();
    const metrics = await getServiceMetrics(service.userId);

    // Calcola la distanza se entrambi hanno posizione
    let distance = Infinity;
    if (requestedService.location.places?.[0] && provider.location) {
      const [lat1, lon1] = requestedService.location.places[0].split(',').map(Number);
      distance = calculateDistance(
        lat1, lon1,
        provider.location.latitude,
        provider.location.longitude
      );
    }

    // Calcola il punteggio di corrispondenza delle competenze
    const skillsMatch = calculateSkillsMatch(requestedService.skills, service.skills);

    // Calcola il punteggio totale
    const factors = {
      distance: distance === Infinity ? 0 : Math.max(0, 100 - distance), // 0-100 basato sulla distanza
      categoryMatch: service.category === requestedService.category,
      skillsMatch, // 0-100
      ratingScore: metrics.averageRating, // 0-5
      availabilityMatch: service.availability?.status === 'active'
    };

    const score = (
      factors.distance * 0.3 + // 30% peso per la distanza
      (factors.categoryMatch ? 20 : 0) + // 20% peso per la categoria
      factors.skillsMatch * 0.3 + // 30% peso per le competenze
      (factors.ratingScore / 5) * 20 // 20% peso per il rating
    );

    return {
      score,
      factors,
      service,
      provider: {
        id: service.userId,
        demographics: {
          ageGroup: provider.demographicData?.ageGroup || 'unknown',
          country: provider.demographicData?.country || 'unknown',
          location: provider.location || null
        },
        metrics
      }
    };
  });

  const matches = await Promise.all(matchPromises);
  return matches.sort((a, b) => b.score - a.score);
}

// Aggiungi una recensione
export async function addReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>) {
  const reviewData = {
    ...review,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const docRef = await addDoc(collection(db, 'reviews'), reviewData);
  return docRef.id;
}

// Aggiorna le statistiche del servizio dopo una nuova recensione
export async function updateServiceStats(serviceId: string) {
  const reviewsRef = collection(db, 'reviews');
  const q = query(reviewsRef, where('serviceId', '==', serviceId));
  const reviewsSnapshot = await getDocs(q);
  const reviews = reviewsSnapshot.docs.map(doc => doc.data() as Review);

  const totalMetrics = reviews.reduce((acc, review) => ({
    rating: acc.rating + review.rating,
    communication: acc.communication + review.metrics.communication,
    quality: acc.quality + review.metrics.quality,
    timeliness: acc.timeliness + review.metrics.timeliness,
    value: acc.value + review.metrics.value
  }), { rating: 0, communication: 0, quality: 0, timeliness: 0, value: 0 });

  const stats = {
    averageRating: totalMetrics.rating / reviews.length,
    totalReviews: reviews.length,
    metrics: {
      communication: totalMetrics.communication / reviews.length,
      quality: totalMetrics.quality / reviews.length,
      timeliness: totalMetrics.timeliness / reviews.length,
      value: totalMetrics.value / reviews.length
    }
  };

  await updateDoc(doc(db, 'services', serviceId), { stats });
  return stats;
}
