
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface Country {
  name: {
    common: string;
    official: string;
  };
  capital?: string[];
  region: string;
  subregion?: string;
  flags: {
    png: string;
    svg: string;
    alt?: string;
  };
  population: number;
  area?: number;
  cca2: string;
  latlng?: number[];
  languages?: Record<string, string>;
  independent?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  countries: Country[] = [];
  selectedCountry: Country | null = null;
  searchTerm = '';
  selectedRegion = 'Tous';
  loading = true;
  errorMessage = '';

  regions = [
    'Tous',
    'Africa',
    'Americas',
    'Asia',
    'Europe',
    'Oceania'
  ];

  constructor(private sanitizer: DomSanitizer) {}

  async ngOnInit(): Promise<void> {
    try {
      const [countriesResponse, populationResponse] =
        await Promise.all([
          fetch(
            'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
          ),
          fetch(
            'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&date=2024'
          )
        ]);

      if (!countriesResponse.ok || !populationResponse.ok) {
        throw new Error('Erreur de chargement des données');
      }

      const countriesData: any[] = await countriesResponse.json();
      const populationData: any[] = await populationResponse.json();

      const populationMap = new Map<string, number>();

      for (const item of populationData[1] || []) {
        if (item.country?.id && item.value !== null) {
          populationMap.set(item.country.id, item.value);
        }
      }

      this.countries = countriesData
        .filter(country =>
          country.name?.common &&
          country.cca2 &&
          country.independent === true
        )
        .map(country => ({
          ...country,
          flags: {
            svg: `https://flagcdn.com/${country.cca2.toLowerCase()}.svg`,
            png: `https://flagcdn.com/w320/${country.cca2.toLowerCase()}.png`
          },
          population: populationMap.get(country.cca2) ?? 0
        }))
        .sort((a, b) =>
          a.name.common.localeCompare(b.name.common)
        );

    } catch (error) {
      console.error('Erreur de chargement :', error);
      this.errorMessage =
        'Impossible de charger les pays et leurs populations. Vérifie ta connexion Internet.';
    } finally {
      this.loading = false;
    }
  }

  get filteredCountries(): Country[] {
    return this.countries.filter(country => {
      const search = this.searchTerm.toLowerCase().trim();

      const matchesSearch =
        country.name.common.toLowerCase().includes(search) ||
        (country.capital?.[0] ?? '')
          .toLowerCase()
          .includes(search);

      const matchesRegion =
        this.selectedRegion === 'Tous' ||
        country.region === this.selectedRegion;

      return matchesSearch && matchesRegion;
    });
  }

  showDetails(country: Country): void {
    this.selectedCountry = country;
  }

  closeDetails(): void {
    this.selectedCountry = null;
  }

  get mapUrl(): SafeResourceUrl | null {
    const coordinates = this.selectedCountry?.latlng;

    if (!coordinates || coordinates.length < 2) {
      return null;
    }

    const [latitude, longitude] = coordinates;

    const box = [
      longitude - 3,
      latitude - 3,
      longitude + 3,
      latitude + 3
    ].join(',');

    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${box}` +
      `&layer=mapnik&marker=${latitude}%2C${longitude}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  formatPopulation(population: number): string {
    if (!population) return 'Non disponible';

    return new Intl.NumberFormat('fr-FR')
      .format(population);
  }

  formatArea(area?: number): string {
    if (!area) return 'Non disponible';

    return new Intl.NumberFormat('fr-FR')
      .format(area) + ' km²';
  }
}
