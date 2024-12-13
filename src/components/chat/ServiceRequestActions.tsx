import React from 'react';
import { doc, updateDoc, deleteDoc, arrayUnion, collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface ServiceRequestActionsProps {
  chatId: string;
  currentUserId: string;
  serviceRequest: any;
}

export function ServiceRequestActions({ chatId, currentUserId, serviceRequest }: ServiceRequestActionsProps) {
  const handleAccept = async () => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      
      // Aggiorna lo stato della richiesta
      await updateDoc(chatRef, {
        'serviceRequest.status': 'accepted',
        'serviceRequest.acceptedAt': new Date(),
        'serviceRequest.acceptedBy': currentUserId,
        type: 'service',  // Marca la chat come chat di servizio
      });

      // Aggiungi un messaggio di sistema
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      await addDoc(messagesRef, {
        text: 'Richiesta di servizio accettata! Puoi procedere con la conversazione.',
        timestamp: new Date(),
        type: 'system',
        systemType: 'service_accepted',
        visibleTo: [serviceRequest.senderId, serviceRequest.recipientId]
      });

    } catch (error) {
      console.error('Errore durante l\'accettazione:', error);
    }
  };

  const handleReject = async () => {
    try {
      // Aggiungi un messaggio di sistema per il rifiuto
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      await addDoc(messagesRef, {
        text: 'Richiesta di servizio rifiutata.',
        timestamp: new Date(),
        type: 'system',
        systemType: 'service_rejected',
        visibleTo: [serviceRequest.senderId, serviceRequest.recipientId]
      });

      // Aggiorna lo stato della richiesta
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        'serviceRequest.status': 'rejected',
        'serviceRequest.rejectedAt': new Date(),
        'serviceRequest.rejectedBy': currentUserId
      });

    } catch (error) {
      console.error('Errore durante il rifiuto:', error);
    }
  };

  // Mostra i pulsanti solo se l'utente è il destinatario e la richiesta è in attesa
  if (currentUserId !== serviceRequest.recipientId || serviceRequest.status !== 'pending') {
    return null;
  }

  return (
    <div className="flex flex-col space-y-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="text-center font-medium mb-2">
        Accetta per avviare la conversazione
      </div>
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleAccept}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          Accetta
        </button>
        <button
          onClick={handleReject}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Rifiuta
        </button>
      </div>
    </div>
  );
}
