import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Menu,
  useMediaQuery,
} from '@mui/material';
import {
  KeyboardArrowDown,
  NotificationsNone,
  Settings,
  ExitToApp,
  HowToReg,
} from '@mui/icons-material';
import { useAuth } from '../AuthContext';
import '../layout/Sidebar.css';

const PRODUCT_NAME = 'Attendance Tracker';

function getMemberDisplayName(user) {
  if (!user) return 'Member';
  return user.fullName || user.memberId || 'Member';
}

function getMemberInitial(user) {
  const name = getMemberDisplayName(user);
  return (name?.[0] || 'M').toUpperCase();
}

/**
 * Member portal shell — same top header language as staff FinalSide,
 * without the admin sidebar / RBAC menu.
 */
function MemberShell() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:768px)');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.type !== 'member') {
    return <Navigate to="/side" replace />;
  }

  const handleLogout = () => {
    setUserMenuAnchor(null);
    logout();
    navigate('/login', { replace: true });
  };

  const handleUserMenuClick = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const attendanceActive =
    location.pathname === '/member' ||
    location.pathname.startsWith('/member/');

  return (
    <div className="sidebar-box sidebar-shell-soft !flex">
      <div
        className={`main-header enhanced sidebar-hidden ${isMobile ? 'mobile' : ''} light-theme`}
      >
        <div className="header-left-section">
          <div className="header-brand-toolbar">
            <div className="header-brand header-brand-lockup header-brand-text-only">
              <div className="header-brand-text">
                <Typography className="header-brand-title" noWrap>
                  {PRODUCT_NAME}
                </Typography>
                {!isMobile ? (
                  <Typography className="header-brand-subtitle" noWrap>
                    Member Portal
                  </Typography>
                ) : null}
              </div>
            </div>
            {!isMobile ? (
              <>
                <span className="header-brand-toolbar-divider" aria-hidden />
                <div className="header-brand-messages">
                  <nav className="header-ribbons" aria-label="Member navigation">
                    <button
                      type="button"
                      className={`header-ribbon${attendanceActive ? ' is-active' : ''}`}
                      onClick={() => navigate('/member')}
                      title="My Attendance"
                    >
                      <HowToReg className="header-ribbon-icon" />
                      <span className="header-ribbon-label">My Attendance</span>
                    </button>
                  </nav>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="header-right-section">
          <div className="header-user-actions-cluster">
            <div
              className="header-icon-button notifications soft"
              aria-label="Notifications"
            >
              <NotificationsNone sx={{ fontSize: '18px' }} />
            </div>

            <div
              className={`header-profile enhanced pill ${isMobile ? 'mobile-compact' : ''}`}
              onClick={handleUserMenuClick}
              role="button"
              tabIndex={0}
              aria-label="Account menu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleUserMenuClick(e);
                }
              }}
            >
              <Avatar className="header-pill-avatar">
                {getMemberInitial(user)}
              </Avatar>
              {!isMobile ? (
                <>
                  <Settings sx={{ fontSize: '16px' }} />
                  <KeyboardArrowDown
                    sx={{ fontSize: '16px' }}
                    className="dropdown-arrow"
                  />
                </>
              ) : (
                <KeyboardArrowDown
                  sx={{ fontSize: '14px' }}
                  className="dropdown-arrow mobile-only"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobile ? (
        <div className="header-ribbons-mobile-bar" aria-label="Member navigation">
          <nav className="header-ribbons header-ribbons--mobile">
            <button
              type="button"
              className={`header-ribbon${attendanceActive ? ' is-active' : ''}`}
              onClick={() => navigate('/member')}
              title="My Attendance"
            >
              <HowToReg className="header-ribbon-icon" />
              <span className="header-ribbon-label">My Attendance</span>
            </button>
          </nav>
        </div>
      ) : null}

      <Menu
        id="member-user-menu"
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        PaperProps={{
          className: 'user-dropdown-menu',
          sx: {
            width: '320px',
            marginTop: '12px',
            borderRadius: '16px',
            '& .MuiList-root': {
              padding: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        TransitionProps={{
          timeout: 200,
        }}
      >
        <Box className="user-menu-shell" onClick={(e) => e.stopPropagation()}>
          <Box className="user-menu-profile-header">
            <Avatar className="user-menu-profile-avatar">
              {getMemberInitial(user)}
            </Avatar>
            <Box className="user-menu-profile-text">
              <Typography component="div" className="user-menu-profile-kicker">
                Account
              </Typography>
              <Typography
                className="user-menu-profile-name"
                noWrap
                title={getMemberDisplayName(user)}
              >
                {getMemberDisplayName(user)}
              </Typography>
              <Typography className="user-menu-profile-role" noWrap>
                {user.memberId ? `Member ID ${user.memberId}` : 'Member'}
              </Typography>
            </Box>
          </Box>

          <div className="user-menu-upgrade-card">
            <Typography className="upgrade-title">Your attendance</Typography>
            <Typography className="upgrade-subtitle">
              View your meeting history and attendance percentage. Records are
              read-only.
            </Typography>
            <Typography className="user-menu-note-meta">Member portal</Typography>
          </div>

          <div className="user-menu-links">
            <button
              type="button"
              className="user-menu-link-btn"
              onClick={() => {
                handleUserMenuClose();
                navigate('/member');
              }}
            >
              <HowToReg sx={{ fontSize: 18 }} />
              <span>My Attendance</span>
            </button>
            <button
              type="button"
              className="user-menu-link-btn danger"
              onClick={handleLogout}
            >
              <ExitToApp sx={{ fontSize: 18 }} />
              <span>Logout</span>
            </button>
          </div>
        </Box>
      </Menu>

      <div className={`main-content ${isMobile ? 'mobile' : ''} sidebar-hidden`}>
        <div
          className="content-body member-portal-content"
          key={`${location.pathname}:${location.key}`}
          data-route-pathname={location.pathname}
          style={{
            paddingLeft: isMobile ? 24 : 72,
            paddingRight: isMobile ? 24 : 72,
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default MemberShell;
