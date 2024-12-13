import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Review } from '../../types/review';
import { Star, MessageSquare, Clock, DollarSign } from 'lucide-react';

interface ReviewListProps {
  serviceId: string;
}

export default function ReviewList({ serviceId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReviews = async () => {
      const reviewsRef = collection(db, 'reviews');
      const q = query(
        reviewsRef,
        where('serviceId', '==', serviceId),
        orderBy('createdAt', 'desc')
      );

      const reviewsSnapshot = await getDocs(q);
      const reviewsData = reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];

      setReviews(reviewsData);
      setLoading(false);
    };

    loadReviews();
  }, [serviceId]);

  if (loading) {
    return <div className="animate-pulse">Caricamento recensioni...</div>;
  }

  if (!reviews.length) {
    return <div className="text-gray-500">Nessuna recensione disponibile</div>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < review.rating
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="font-medium">{review.rating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-gray-500">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className="text-gray-700 mb-4">{review.comment}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-sm font-medium">Comunicazione</div>
                <div className="text-gray-600">{review.metrics.communication}/5</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-sm font-medium">Qualità</div>
                <div className="text-gray-600">{review.metrics.quality}/5</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-sm font-medium">Puntualità</div>
                <div className="text-gray-600">{review.metrics.timeliness}/5</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              <div>
                <div className="text-sm font-medium">Rapporto Qualità/Prezzo</div>
                <div className="text-gray-600">{review.metrics.value}/5</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
