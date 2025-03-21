import {Component, OnInit} from '@angular/core';
import {SidebarComponent} from "../../../../components/sidebar/sidebar.component";
import {HomeNavComponent} from "../home-nav/home-nav.component";
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {LoginComponent} from '../../../login/login.component';
import {AuthState} from '../../../../ngrx/auth/auth.state';
import {Store} from '@ngrx/store';
import * as authActions from '../../../../ngrx/auth/auth.actions';
import {logout} from '../../../../ngrx/auth/auth.actions';
import {BackgroundColorService} from '../../../../services/background-color/background-color.service';
import {BoardModel} from '../../../../models/board.model';
import {Observable, Subscription} from 'rxjs';
import * as boardActions from '../../../../ngrx/board/board.actions';
import {BoardState} from '../../../../ngrx/board/board.state';
import {AsyncPipe, NgStyle} from '@angular/common';
import {BackgroundPipe} from '../../../../shared/pipes/background.pipe';
import {Router, RouterLink} from '@angular/router';
import {NgxSkeletonLoaderComponent} from 'ngx-skeleton-loader';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    SidebarComponent,
    HomeNavComponent,
    MatButton,
    MatIcon,
    LoginComponent,
    AsyncPipe,
    NgStyle,
    BackgroundPipe,
    RouterLink,
    NgxSkeletonLoaderComponent,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  isSlideBarVisible = false;
  boards$!: Observable<BoardModel[] | null>;
  invitedBoards$!: Observable<BoardModel[] | null>;
  isGettingBoards!: boolean;

  constructor(private backgroundService: BackgroundColorService,
              private router: Router,
              private store: Store<{ auth: AuthState, board: BoardState }>) {
    this.backgroundService.setNavbarTextColor('rgb(0, 0, 0)');
    this.backgroundService.setSidebarColor('rgb(245, 255, 248)');
    this.backgroundService.setLogo('rgb(245, 255, 248)');
    // this.store.dispatch(boardActions.getBoards());
  }

  ngOnInit(): void {
    this.boards$ = this.store.select('board', 'boards');
    this.invitedBoards$ = this.store.select('board', 'invitedBoards');
    this.store.select('board', 'isBoardsGetting').subscribe(isGettingBoards => {
      this.isGettingBoards = isGettingBoards;
      console.log("isGettingBoards", isGettingBoards);
    });
  }

  navigateToBoard(boardId: string): void {
    this.router.navigate(['/board/kanban', boardId]).then(r => console.log(r));
  }

  deleteBoard(boardId: string, event: Event): void {
    event.stopPropagation(); // Stop event propagation
    console.log(`Deleting board with ID: ${boardId}`);
    // Call your delete logic here
    this.store.dispatch(boardActions.deleteBoard({boardId}));
  }


  onLinkActivated(): void {
    this.isSlideBarVisible = false;
  }
}
