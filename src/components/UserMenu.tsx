import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { User as UserIcon, Settings, HelpCircle, LogOut, ChevronDown, Check } from 'lucide-react';
import { useLanguage, Language } from '../contexts/LanguageContext';

interface UserProfile {
  firstName: string;
  lastName: string;
  chineseName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  phoneNumber: string;
  contactAddress: string;
}

const EMPTY_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  chineseName: '',
  gender: '',
  dateOfBirth: '',
  nationality: '',
  documentType: '',
  documentNumber: '',
  phoneNumber: '',
  contactAddress: '',
};

interface Props {
  user: User;
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: Props) {
  const { language, setLanguage, t } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load profile from Firestore on mount
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.profile) setProfile({ ...EMPTY_PROFILE, ...data.profile });
      }
    });
  }, [user]);

  async function handleSaveProfile() {
    setSaving(true);
    await setDoc(doc(db, 'users', user.uid), { profile }, { merge: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const avatarUrl = user.photoURL;
  const initials = user.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? '?';

  function MenuItem({ icon: Icon, label, onClick, danger }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
          danger
            ? 'text-red-600 hover:bg-red-50'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <>
      {/* ── Dropdown Trigger ── */}
      <Popover>
        <PopoverTrigger
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {/* Avatar */}
          {avatarUrl ? (
            <img src={avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
          {/* Name + email */}
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium leading-tight">{user.displayName ?? user.email}</p>
            {user.displayName && <p className="text-xs text-slate-500 leading-tight">{user.email}</p>}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
        </PopoverTrigger>

        <PopoverContent side="bottom" align="end" className="w-56 p-1.5">
          {/* User info header */}
          <div className="px-3 py-2 mb-1 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800 truncate">{user.displayName ?? '—'}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          <MenuItem
            icon={UserIcon}
            label={t('View Profile', '查看资料')}
            onClick={() => setProfileOpen(true)}
          />
          <MenuItem
            icon={Settings}
            label={t('Settings', '设置')}
            onClick={() => setSettingsOpen(true)}
          />
          <MenuItem
            icon={HelpCircle}
            label={t('Help', '帮助')}
            onClick={() => setHelpOpen(true)}
          />

          <div className="my-1 border-t border-slate-100" />

          <MenuItem
            icon={LogOut}
            label={t('Sign Out', '退出登录')}
            onClick={onLogout}
            danger
          />
        </PopoverContent>
      </Popover>

      {/* ── Profile Dialog ── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('My Profile', '个人资料')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('First Name', '名')}</Label>
                <Input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} placeholder="John" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Last Name', '姓')}</Label>
                <Input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" />
              </div>
            </div>

            {/* Chinese name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Name in Chinese', '中文姓名')}</Label>
              <Input value={profile.chineseName} onChange={e => setProfile(p => ({ ...p, chineseName: e.target.value }))} placeholder="张三" />
            </div>

            {/* Gender + DOB */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Gender', '性别')}</Label>
                <Select value={profile.gender} onValueChange={v => setProfile(p => ({ ...p, gender: v }))}>
                  <SelectTrigger className="w-full bg-white h-9"><SelectValue placeholder={t('Select', '请选择')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('Male', '男')}</SelectItem>
                    <SelectItem value="female">{t('Female', '女')}</SelectItem>
                    <SelectItem value="other">{t('Other', '其他')}</SelectItem>
                    <SelectItem value="prefer_not">{t('Prefer not to say', '不愿透露')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Date of Birth', '出生日期')}</Label>
                <Input type="date" value={profile.dateOfBirth} onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))} className="bg-white" />
              </div>
            </div>

            {/* Nationality + Document type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Nationality', '国籍')}</Label>
                <Input value={profile.nationality} onChange={e => setProfile(p => ({ ...p, nationality: e.target.value }))} placeholder={t('e.g. British', '例：英国')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Document Type', '证件类型')}</Label>
                <Select value={profile.documentType} onValueChange={v => setProfile(p => ({ ...p, documentType: v }))}>
                  <SelectTrigger className="w-full bg-white h-9"><SelectValue placeholder={t('Select', '请选择')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="中国护照">Chinese Passport</SelectItem>
                    <SelectItem value="港澳居民来往内地通行证">Travel Permit for Hong Kong and Macao Residents to the Mainland</SelectItem>
                    <SelectItem value="中华人民共和国港澳居民居住证">Residence Permit for Hong Kong and Macao Residents of the People's Republic of China</SelectItem>
                    <SelectItem value="台湾居民来往大陆通行证">Travel Permit for Taiwan Residents to the Mainland</SelectItem>
                    <SelectItem value="中华人民共和国台湾居民居住证">Residence Permit for Taiwan Residents of the People's Republic of China</SelectItem>
                    <SelectItem value="外国护照">Foreign Passport</SelectItem>
                    <SelectItem value="外国人永久居留身份证（外国人永久居留证）">Permanent Resident Identity Card for Foreigners (Permanent Resident Card for Foreigners)</SelectItem>
                    <SelectItem value="中华人民共和国外国人工作许可证（A类）">Work Permit for Foreigners of the People's Republic of China (Category A)</SelectItem>
                    <SelectItem value="中华人民共和国外国人工作许可证（B类）">Work Permit for Foreigners of the People's Republic of China (Category B)</SelectItem>
                    <SelectItem value="中华人民共和国外国人工作许可证（C类）">Work Permit for Foreigners of the People's Republic of China (Category C)</SelectItem>
                    <SelectItem value="其他个人证件">Other Personal Documents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Document number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Document Number', '证件号码')}</Label>
              <Input value={profile.documentNumber} onChange={e => setProfile(p => ({ ...p, documentNumber: e.target.value }))} placeholder="AB1234567" />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Phone Number', '联系电话')}</Label>
              <Input value={profile.phoneNumber} onChange={e => setProfile(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="+86 138 0000 0000" />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Contact Address', '联系地址')}</Label>
              <Input value={profile.contactAddress} onChange={e => setProfile(p => ({ ...p, contactAddress: e.target.value }))} placeholder={t('Current residential address', '当前居住地址')} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSaveProfile} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              {saved ? <><Check className="w-4 h-4" />{t('Saved!', '已保存！')}</> : saving ? t('Saving…', '保存中…') : t('Save Profile', '保存资料')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('Settings', '设置')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('Language', '语言')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {([['en', 'English', 'English'], ['zh', '中文', 'Chinese']] as [Language, string, string][]).map(([code, native]) => (
                  <button
                    key={code}
                    onClick={() => setLanguage(code)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      language === code
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {native}
                    {language === code && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{t('Changes apply immediately.', '更改立即生效。')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>{t('Close', '关闭')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Help Dialog ── */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('Help', '帮助')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>{t('TravelTrack helps global professionals track travel days and calculate China individual income tax.', 'TravelTrack 帮助全球专业人士追踪出行天数并计算中国个人所得税。')}</p>
            <div className="space-y-1.5">
              <p className="font-medium text-slate-800">{t('Quick Guide', '快速指南')}</p>
              <ul className="space-y-1 list-disc list-inside text-slate-500">
                <li>{t('Add travel records via the "Add Record" tab', '在"添加记录"选项卡中添加出行记录')}</li>
                <li>{t('View your calendar to see China vs. overseas days', '在日历中查看境内外天数')}</li>
                <li>{t('Use the Tax tab to calculate IIT', '在税务选项卡中计算个税')}</li>
                <li>{t('Export the official declaration form as Excel', '导出官方申报表为Excel')}</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              {t('For issues, visit ', '如有问题，请访问 ')}
              <a href="https://github.com/ksmn1133/Travel-Tracker" target="_blank" rel="noreferrer" className="text-blue-600 underline">GitHub</a>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpOpen(false)}>{t('Close', '关闭')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
