from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user
from app.core.password_reset import consume_reset_token, create_reset_token
from app.core.security import hash_password, verify_password
from app.core.sessions import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_session,
    destroy_all_sessions,
    destroy_session,
    set_session_cookie,
)
from app.db.models import User, Workspace, WorkspaceMembership
from app.db.session import get_db
from app.schemas import (
    ChangePasswordRequest,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdateRequest,
    SessionResponse,
    SigninRequest,
    SignupRequest,
    UserOut,
    WorkspaceMembershipOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _load_workspaces(db: AsyncSession, user: User) -> list[WorkspaceMembershipOut]:
    result = await db.execute(
        select(Workspace, WorkspaceMembership.role)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user.id)
        .order_by(Workspace.created_at)
    )
    return [
        WorkspaceMembershipOut(
            id=w.id, name=w.name, owner_user_id=w.owner_user_id, retention_days=w.retention_days, created_at=w.created_at, role=role
        )
        for w, role in result.all()
    ]


@router.post("/signup", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(email=payload.email, password_hash=hash_password(payload.password), display_name=payload.display_name)
    db.add(user)
    await db.flush()

    workspace = Workspace(name=payload.workspace_name or "My Workspace", owner_user_id=user.id)
    db.add(workspace)
    await db.flush()

    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    await db.commit()

    session_id = await create_session(user.id)
    set_session_cookie(response, session_id, settings)
    membership = WorkspaceMembershipOut(
        id=workspace.id,
        name=workspace.name,
        owner_user_id=workspace.owner_user_id,
        retention_days=workspace.retention_days,
        created_at=workspace.created_at,
        role="owner",
    )
    return SessionResponse(user=UserOut.model_validate(user), workspaces=[membership])


@router.post("/signin", response_model=SessionResponse)
async def signin(
    payload: SigninRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    invalid_credentials = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials
    if user.status != "active":
        raise invalid_credentials

    session_id = await create_session(user.id)
    set_session_cookie(response, session_id, settings)
    workspaces = await _load_workspaces(db, user)
    return SessionResponse(user=UserOut.model_validate(user), workspaces=workspaces)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
async def signout(
    request: Request, response: Response, settings: Settings = Depends(get_settings)
) -> None:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        await destroy_session(session_id)
    clear_session_cookie(response, settings)


@router.get("/me", response_model=SessionResponse)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    workspaces = await _load_workspaces(db, current_user)
    return SessionResponse(user=UserOut.model_validate(current_user), workspaces=workspaces)


@router.patch("/me", response_model=SessionResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    await db.commit()
    workspaces = await _load_workspaces(db, current_user)
    return SessionResponse(user=UserOut.model_validate(current_user), workspaces=workspaces)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()

    # A changed password should not leave any session — including this one — valid on an
    # old credential. The client is expected to treat this as a forced sign-out.
    await destroy_all_sessions(current_user.id)
    clear_session_cookie(response, settings)


_RESET_REQUESTED_MESSAGE = "If an account exists for that email, a password reset link has been sent."


@router.post("/password-reset/request", response_model=MessageResponse)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    """Always returns the same generic message, whether or not the email is registered —
    the response can't be used to enumerate accounts. Only enqueues the reset email when
    a matching active user actually exists."""

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is not None and user.status == "active":
        token = await create_reset_token(user.id)
        frontend_origin = settings.cors_origins[0] if settings.cors_origins else ""
        reset_url = f"{frontend_origin}/reset-password?token={token}"

        from app.workers.tasks import send_password_reset_email  # local import avoids a module-load cycle

        send_password_reset_email.delay(user.email, reset_url)

    return MessageResponse(message=_RESET_REQUESTED_MESSAGE)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)) -> None:
    user_id = await consume_reset_token(payload.token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or has expired.")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or has expired.")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    await destroy_all_sessions(user.id)
