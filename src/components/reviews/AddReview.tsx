import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { addReview, updateServiceStats } from '../../utils/serviceMatching';

interface AddReviewProps {
  serviceId: string;
  providerId: string;
  onReviewAdded: () => void;
}

export default function AddReview({ serviceId, providerId, onReviewAdded }: AddReviewProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [metrics, setMetrics] = useState({
    communication: 0,
    quality: 0,
    timeliness: 0,
    value: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addReview({
        serviceId,
        providerId,
        reviewerId: 'currentUserId', // TODO: Get from auth context
        rating,
        comment,
        metrics
      });

      await updateServiceStats(serviceId);
      onReviewAdded();
      
      // Reset form
      setRating(0);
      setComment('');
      setMetrics({
        communication: 0,
        quality: 0,
        timeliness: 0,
        value: 0
      });
    } catch (error) {
      console.error('Error adding review:', error);
    } finally {
      setLoading(false);
    }
  };

  const RatingInput = ({ value, onChange, label }: { 
    value: number; 
    onChange: (value: number) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`w-6 h-6 ${
                star <= value
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <RatingInput
          value={rating}
          onChange={setRating}
          label="Valutazione Generale"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Commento
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
          placeholder="Scrivi la tua recensione..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RatingInput
          value={metrics.communication}
          onChange={(value) => setMetrics({ ...metrics, communication: value })}
          label="Comunicazione"
        />
        <RatingInput
          value={metrics.quality}
          onChange={(value) => setMetrics({ ...metrics, quality: value })}
          label="Qualità"
        />
        <RatingInput
          value={metrics.timeliness}
          onChange={(value) => setMetrics({ ...metrics, timeliness: value })}
          label="Puntualità"
        />
        <RatingInput
          value={metrics.value}
          onChange={(value) => setMetrics({ ...metrics, value: value })}
          label="Rapporto Qualità/Prezzo"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Invio in corso...' : 'Invia Recensione'}
        </button>
      </div>
    </form>
  );
}
