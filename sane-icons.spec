Name:           sane-icons
Version:        1.0.0
Release:        1%{?dist}
Summary:        Sane icon theme, preset icons, mappings, and runtime generator for saneOS

License:        Apache-2.0
URL:            https://github.com/saneOS/sane-icons
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch
BuildRequires:  nodejs >= 18.0.0
BuildRequires:  npm
Requires:       nodejs >= 18.0.0
Requires:       hicolor-icon-theme
Requires:       systemd

%description
Sane Icon Theme for saneOS and Fedora KDE Plasma.
Provides preset 128px SVG icon badges, application ID mappings,
and a runtime icon generator for automatically fetching and generating
monochrome app icons in Sane badge style.

%prep
%autosetup -n %{name}-%{version}

%build
cd icon-badge-svg
npm install --no-audit --no-fund
npm run build
cd ..

%install
rm -rf %{buildroot}
node scripts/install-theme.js %{buildroot}

%post
if [ -x /usr/bin/systemctl ]; then
    /usr/bin/systemctl --global preset sane-icon-sync.path sane-icon-sync.timer &>/dev/null || :
fi
/bin/touch --no-create %{_datadir}/icons/Sane &>/dev/null || :
if [ -x %{_bindir}/gtk-update-icon-cache ]; then
    %{_bindir}/gtk-update-icon-cache -f -t %{_datadir}/icons/Sane &>/dev/null || :
fi

%postun
if [ $1 -eq 0 ]; then
    /bin/touch --no-create %{_datadir}/icons/Sane &>/dev/null || :
    if [ -x %{_bindir}/gtk-update-icon-cache ]; then
        %{_bindir}/gtk-update-icon-cache -f -t %{_datadir}/icons/Sane &>/dev/null || :
    fi
fi

%preun
if [ $1 -eq 0 ] && [ -x /usr/bin/systemctl ]; then
    /usr/bin/systemctl --global disable sane-icon-sync.path sane-icon-sync.timer &>/dev/null || :
fi

%files
%license LICENSE NOTICE
%doc README.md
%{_bindir}/sane-icon-badge
%{_bindir}/sane-icon-generator
%{_bindir}/sane-icon-sync
%{_datadir}/icons/Sane
%{_datadir}/icons/sane-icons
%{_datadir}/icons/sane
%{_datadir}/sane-icons
/usr/lib/systemd/user/sane-icon-sync.service
/usr/lib/systemd/user/sane-icon-sync.path
/usr/lib/systemd/user/sane-icon-sync.timer
/usr/lib/systemd/user-preset/90-sane-icons.preset
/etc/xdg/autostart/sane-icon-sync.desktop

%changelog
* Wed Sep 03 2025 saneOS Maintainers <maintainers@saneos.org> - 1.0.0-1
- Initial RPM release of sane-icons
