import { Routes } from '@angular/router';
import { AppLayout } from '@/app/layout/components/app.layout';
import { authGuard, guestGuard, resourceGuard, universeGuard } from './core/guards';

export const appRoutes: Routes = [
    {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
        title: 'Entrar'
    },
    {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
        title: 'Cadastro'
    },
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
            {
                path: 'dashboard',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Painel' },
                loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
                title: 'Painel'
            },
            {
                path: 'universes',
                data: { breadcrumb: 'Meus universes' },
                loadComponent: () => import('./features/universes/universes').then((m) => m.Universes),
                title: 'Meus universes'
            },
            {
                path: 'r/:resource',
                canActivate: [universeGuard, resourceGuard],
                data: { breadcrumb: 'Cadastros' },
                loadComponent: () => import('./features/resources/resource-list').then((m) => m.ResourceList)
            },
            {
                path: 'divisions',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Divisões' },
                loadComponent: () => import('./features/divisions/divisions-board').then((m) => m.DivisionsBoard),
                title: 'Divisões'
            },
            {
                path: 'episodes',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Episódios' },
                loadComponent: () => import('./features/episodes/episodes-page').then((m) => m.EpisodesPage),
                title: 'Episódios'
            },
            {
                path: 'stats/reigns',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Estatísticas de reinados' },
                loadComponent: () => import('./features/stats/reign-stats').then((m) => m.ReignStats),
                title: 'Estatísticas de reinados'
            },
            {
                path: 'episodes/:id/card',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Card do episódio' },
                loadComponent: () => import('./features/episodes/episode-card').then((m) => m.EpisodeCardPage),
                title: 'Card do episódio'
            },
            {
                path: 'tournaments/:id',
                canActivate: [universeGuard],
                data: { breadcrumb: 'Torneio' },
                loadComponent: () => import('./features/tournaments/tournament-page').then((m) => m.TournamentPage),
                title: 'Torneio'
            }
        ]
    },
    { path: '**', redirectTo: '' }
];
