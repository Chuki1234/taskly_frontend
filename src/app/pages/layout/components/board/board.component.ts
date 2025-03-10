import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { BackgroundColorService } from '../../../../services/background-color/background-color.service';
import { AsyncPipe, JsonPipe, NgStyle } from '@angular/common';
import { BoardState } from '../../../../ngrx/board/board.state';
import { Store } from '@ngrx/store';
import {
  combineLatest,
  distinctUntilKeyChanged,
  EMPTY,
  filter,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { BoardModel } from '../../../../models/board.model';
import { BackgroundPipe } from '../../../../shared/pipes/background.pipe';
import { GatewayService } from '../../../../services/gateway/gateway.service';
import { ListModel } from '../../../../models/list.model';
import { ListState } from '../../../../ngrx/list/list.state';
import { log } from '@angular-devkit/build-angular/src/builders/ssr-dev-server';
import * as boardActions from '../../../../ngrx/board/board.actions';
import * as listActions from '../../../../ngrx/list/list.actions';
import { CardState } from '../../../../ngrx/card/card.state';
import { ChecklistItemState } from '../../../../ngrx/checklistItem/checklistItem.state';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    NgStyle,
    AsyncPipe,
    BackgroundPipe,
    JsonPipe,
  ],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnInit, OnDestroy {
  backgroundImage: string | null =
    'https://images.unsplash.com/photo-1542435503-956c469947f6?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZGVza3RvcHxlbnwwfHwwfHx8MA%3D%3D';

  constructor(
    private backgroundService: BackgroundColorService,
    private gateway: GatewayService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private store: Store<{
      board: BoardState;
      list: ListState;
      card: CardState;
      checklistItem: ChecklistItemState;
    }>,
  ) {
    this.board$ = this.store.select('board', 'board');
  }

  subscriptions: Subscription[] = [];
  board$!: Observable<BoardModel | null>;
  routeSubscription!: Subscription;
  boardId!: string;
  lists: ListModel[] = [];

  ngOnInit(): void {
    console.log('board component oninit');
    console.log(this.activatedRoute.firstChild);

    const firstBoardId = this.activatedRoute.firstChild?.snapshot.params['id'];
    if (firstBoardId) {
      this.handleOnBoardChange(firstBoardId);
    }

    this.routeSubscription = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        switchMap(() => {
          console.log('NavigationEnd triggered');
          const childRoute = this.activatedRoute.firstChild;
          return childRoute ? childRoute.params : [];
        }),
      )
      .subscribe((params) => {
        this.handleOnBoardChange(params['id']);
      });
  }

  handleOnBoardChange(boardId: string) {
    console.log('layout oninit ', boardId);
    const newBoardId = boardId;
    if (this.boardId) {
      this.gateway.disconnect();
    }
    this.boardId = newBoardId;
    console.log('🚀 Board ID:', this.boardId);
    this.gateway.connect();

    console.log('unsubscribe all');
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    this.store.dispatch(listActions.clearListStore());

    this.store.dispatch(boardActions.getBoard({ boardId: this.boardId }));
    this.store.dispatch(listActions.getLists({ boardId: this.boardId }));
    this.subscriptions.push(
      this.store
        .select('list', 'isGettingListsSuccess')
        .subscribe((isGettingListsSuccess) => {
          if (isGettingListsSuccess) {
            this.subscriptions.push(
              this.store
                .select('board', 'board')
                .pipe(
                  filter((board) => !!board),
                  distinctUntilKeyChanged('id'),
                  switchMap((board) =>
                    this.store.select('list', 'lists').pipe(
                      map((lists) => ({
                        board,
                        lists:
                          lists?.filter((list) => list.boardId === board.id) ??
                          [],
                      })),
                      take(1),
                    ),
                  ),
                )
                .subscribe(({ board, lists }) => {
                  if (lists.length > 0 && board.listsCount) {
                    console.log(
                      '🚀 Joining board:',
                      board.id,
                      'with lists:',
                      lists,
                    );
                    this.gateway.joinBoard(board, lists);
                  } else if (!board.listsCount) {
                    console.log(
                      '🚀 Joining board:',
                      board.id,
                      'with lists:',
                      [],
                    );
                    this.gateway.joinBoard(board, []);
                  }
                }),
            );
          }
        }),

      this.store.select('list', 'lists').subscribe((lists) => {
        this.lists = lists;
      }),
      this.store.select('board', 'board').subscribe((board) => {
        if (board) {
          if (
            board.background &&
            typeof board.background === 'object' &&
            'fileLocation' in board.background
          ) {
            this.extractPrimaryColor(board.background.fileLocation as string);
            this.backgroundImage = board.background.fileLocation as string;
          }
        }
      }),
      this.backgroundService.backgroundImage$.subscribe((imageUrl) => {
        this.backgroundImage = imageUrl;
      }),

      this.store
        .select('list', 'isAddingListSuccess')
        .subscribe((isAddingListSuccess) => {
          if (isAddingListSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),

      this.store
        .select('card', 'isUpdateTaskSuccess')
        .subscribe((isSuccess) => {
          if (isSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('list', 'isDeletingListSuccess')
        .subscribe((isDeletingListSuccess) => {
          if (isDeletingListSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('list', 'isDeletingCardSuccess')
        .subscribe((isDeletingCardSuccess) => {
          if (isDeletingCardSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('list', 'isUpdatingListsSuccess')
        .subscribe((isUpdatingListsSuccess) => {
          if (isUpdatingListsSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('list', 'isAddingCardSuccess')
        .subscribe((isAddingCardSuccess) => {
          if (isAddingCardSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('list', 'isUpdatingCardSuccess')
        .pipe(
          filter((isUpdating) => isUpdating),
          tap(() => {
            this.gateway.onListChange(this.boardId, this.lists);
            this.store.dispatch(listActions.resetUpdatingCardSuccess());
          }),
        )
        .subscribe(),
      this.gateway.listenListChange().subscribe((lists: ListModel[]) => {
        // this.lists = lists;
        this.store.dispatch(listActions.storeNewLists({ lists }));
      }),
      this.store
        .select('checklistItem', 'isDeleteChecklistItemSuccess')
        .subscribe((isDeleteChecklistItemSuccess) => {
          if (isDeleteChecklistItemSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('checklistItem', 'isAddChecklistItemSuccess')
        .subscribe((isAddChecklistItemSuccess) => {
          if (isAddChecklistItemSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
      this.store
        .select('checklistItem', 'isToggleChecklistItemSuccess')
        .subscribe((isSuccess) => {
          if (isSuccess) {
            this.gateway.onListChange(this.boardId, this.lists);
          }
        }),
    );
  }

  extractPrimaryColor(imageUrl: string): void {
    const image = new Image();
    image.src = imageUrl;
    image.crossOrigin = 'Anonymous';

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let i = 0; i < imageData.length; i += 4 * 100) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
      }

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      const primaryColor = `rgb(${r}, ${g}, ${b})`;
      console.log('Extracted Sidebar Color:', primaryColor);

      this.backgroundService.setLogo(primaryColor);
      this.backgroundService.setSidebarColor(primaryColor);
      this.backgroundService.setNavbarTextColor(primaryColor);
    };
  }

  ngOnDestroy() {
    console.log('unsubscribing routeSub');
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.store.dispatch(boardActions.clearBoardBackground());
    this.store.dispatch(listActions.clearListStore());
    this.routeSubscription.unsubscribe();
    this.gateway.disconnect();
  }

  protected readonly take = take;
}
