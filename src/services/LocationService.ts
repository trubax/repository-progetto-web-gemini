import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  method: string;
  country?: string;
  city?: string;
  region?: string;
}

export class LocationService {
  private static instance: LocationService;
  private geocodingApiKey = 'YOUR_GEOCODING_API_KEY'; // Sostituire con la chiave API reale

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  public async getLocation(): Promise<LocationData | null> {
    try {
      // Prova prima con HTML5 Geolocation
      const gpsLocation = await this.getGPSLocation();
      if (gpsLocation) {
        const enrichedLocation = await this.enrichLocationData(gpsLocation);
        await this.saveLocationData(enrichedLocation);
        return enrichedLocation;
      }

      // Se GPS fallisce, prova con IP Geolocation
      const ipLocation = await this.getIPLocation();
      if (ipLocation) {
        await this.saveLocationData(ipLocation);
        return ipLocation;
      }

      // Se tutto fallisce, prova con il fallback browser
      const browserLocation = await this.getBrowserLocation();
      if (browserLocation) {
        await this.saveLocationData(browserLocation);
        return browserLocation;
      }

      return null;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  private async getGPSLocation(): Promise<LocationData | null> {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              method: 'GPS'
            });
          },
          () => resolve(null),
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        resolve(null);
      }
    });
  }

  private async getIPLocation(): Promise<LocationData | null> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 10000, // IP geolocation è meno preciso
          timestamp: Date.now(),
          method: 'IP',
          country: data.country_name,
          city: data.city,
          region: data.region
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting IP location:', error);
      return null;
    }
  }

  private async getBrowserLocation(): Promise<LocationData | null> {
    try {
      const response = await fetch('https://browser-location-service.com/location');
      const data = await response.json();
      
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: 15000, // Browser location è il meno preciso
        timestamp: Date.now(),
        method: 'Browser'
      };
    } catch (error) {
      console.error('Error getting browser location:', error);
      return null;
    }
  }

  private async enrichLocationData(location: LocationData): Promise<LocationData> {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${location.latitude}+${location.longitude}&key=${this.geocodingApiKey}`
      );
      const data = await response.json();
      
      if (data.results && data.results[0]) {
        const result = data.results[0].components;
        return {
          ...location,
          country: result.country,
          city: result.city,
          region: result.state
        };
      }
      
      return location;
    } catch (error) {
      console.error('Error enriching location data:', error);
      return location;
    }
  }

  private async saveLocationData(location: LocationData): Promise<void> {
    try {
      const userId = localStorage.getItem('currentUser');
      if (!userId) return;

      const userRef = doc(db, 'users', userId);
      const locationRef = doc(db, 'locations', userId);

      // Aggiorna la posizione corrente dell'utente
      await updateDoc(userRef, {
        lastKnownLocation: {
          ...location,
          updatedAt: new Date()
        }
      });

      // Salva lo storico delle posizioni
      await setDoc(locationRef, {
        locations: [{
          ...location,
          timestamp: new Date()
        }]
      }, { merge: true });

      // Aggiorna le statistiche demografiche
      await this.updateDemographicStats(location);

    } catch (error) {
      console.error('Error saving location data:', error);
    }
  }

  private async updateDemographicStats(location: LocationData): Promise<void> {
    try {
      const statsRef = doc(db, 'statistics', 'demographics');
      
      // Aggiorna le statistiche per paese
      if (location.country) {
        await updateDoc(statsRef, {
          [`locations.${location.country}`]: increment(1)
        });
      }

      // Aggiorna le statistiche per città se disponibile
      if (location.city) {
        await updateDoc(statsRef, {
          [`cities.${location.city}`]: increment(1)
        });
      }

      // Aggiorna le statistiche per regione se disponibile
      if (location.region) {
        await updateDoc(statsRef, {
          [`regions.${location.region}`]: increment(1)
        });
      }

    } catch (error) {
      console.error('Error updating demographic stats:', error);
    }
  }
}
