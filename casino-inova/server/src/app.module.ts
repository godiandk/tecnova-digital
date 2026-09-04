import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LobbyModule } from './modules/lobby/lobby.module';
import { SiteModule } from './site/site.module';
import { LegalModule } from './modules/legal/legal.module';
import { StoreModule } from './modules/store/store.module';
import { SlotsModule } from './modules/games/slots/slots.module';
import { RouletteModule } from './modules/games/roulette/roulette.module';
import { BlackjackModule } from './modules/games/blackjack/blackjack.module';
import { BaccaratModule } from './modules/games/baccarat/baccarat.module';
import { BancaFrancesaModule } from './modules/games/banca-francesa/banca-francesa.module';
import { RolesModule } from './modules/roles/roles.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { TrucoModule } from './modules/games/truco/truco.module';
import { DominoModule } from './modules/games/domino/domino.module';
import { PokerModule } from './modules/games/poker/poker.module';
import { FriendsModule } from './modules/friends/friends.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { BacBoModule } from './modules/games/bac-bo/bac-bo.module';
import { StockMarketModule } from './modules/games/stock-market/stock-market.module';
import { ChatModule } from './modules/chat/chat.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { RecompensasModule } from './modules/recompensas/recompensas.module';
import { SharedGamesModule } from './modules/games/shared/shared-games.module';
import { CoreDeSalasModule } from './modules/games/core/core.module';

@Module({
  imports: [
    DatabaseModule,
    // Global: os dez jogos compartilham o mesmo registro de ações já executadas.
    SharedGamesModule,
    // Global: log de eventos e janela de reconexão, compartilhados pelas mesas.
    CoreDeSalasModule,
    AuthModule,
    UsersModule,
    WalletModule,
    LobbyModule,
    StoreModule,
    SlotsModule,
    RouletteModule,
    BlackjackModule,
    BaccaratModule,
    BancaFrancesaModule,
    BacBoModule,
    StockMarketModule,
    ChatModule,
    RoadmapModule,
    TournamentsModule,
    RecompensasModule,
    RolesModule,
    CouponsModule,
    TrucoModule,
    DominoModule,
    PokerModule,
    FriendsModule,
    RoomsModule,
    /*
     * SiteModule TEM que ser o último da lista.
     *
     * Ele registra um curinga `@Get('*')` que devolve o index.html, e o Nest casa rota
     * na ordem em que foi registrada. Qualquer módulo abaixo dele fica inalcançável: o
     * servidor responde a página do site no lugar da API, com status 200, e o app diz
     * coisas como "não foi possível carregar" sem nenhum erro no log.
     *
     * Já aconteceu: numa versão anterior o SiteModule ficou antes de FriendsModule e
     * RoomsModule, e a tela de Amigos quebrava com "Cannot read properties of
     * undefined" porque /amigos/pendentes devolvia HTML. É o que
     * verificacao/verifica-rotas.ts existe pra pegar.
     */
    // Antes do SiteModule, que é curinga e engoliria /legal/termos.
    LegalModule,
    SiteModule,
  ],
  /*
   * Guard global: toda rota exige token, MENOS as marcadas com @Publico(). O padrão
   * fechado é de propósito — esquecer de proteger uma rota nova é mais fácil, e bem
   * mais caro, do que esquecer de abrir uma.
   */
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
