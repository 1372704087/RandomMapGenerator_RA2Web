// 0x595fb0 watch_595FB0 size=350

int __fastcall sub_595FB0(HWND hDlg, int (*a2)(void))
{
  int v4; // eax
  char *v5; // esi
  void *v6; // eax
  void *v7; // eax
  void *v8; // esi
  void *v9; // esi
  char *v10; // eax
  char *v11; // eax
  int v12; // ecx
  void *v13; // esi
  _DWORD v15[2]; // [esp+10h] [ebp-260h] BYREF
  _DWORD v16[2]; // [esp+18h] [ebp-258h] BYREF
  _BYTE v17[36]; // [esp+20h] [ebp-250h] BYREF
  void **v18; // [esp+44h] [ebp-22Ch] BYREF
  _BYTE v19[12]; // [esp+9Ch] [ebp-1D4h] BYREF
  int v20; // [esp+A8h] [ebp-1C8h]
  char Destination[128]; // [esp+B0h] [ebp-1C0h] BYREF
  struct _WIN32_FIND_DATAA FindFileData; // [esp+130h] [ebp-140h] BYREF

  sub_65D430(v15);
  v15[0] = &rc_ptr<WDTTerritory>::`vftable';
  if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
  {
    v4 = sub_7B0390(v16, *(_DWORD *)dword_A8B240);
    sub_65D480(*(_DWORD *)(v4 + 4));
    v16[0] = &rc_ptr<WDTTerritory>::`vftable';
    sub_65D460(v16);
  }
  if ( v15[1] != 0 )
    dword_ABE028 = 4;
  v5 = (char *)sub_5E84D0();
  memset(Destination, 0, sizeof(Destination));
  strncpy(Destination, aRmcache, 0x80u);
  strncat(Destination, v5, 0x80u);
  operator delete(v5);
  strncat(Destination, aMmp, 0x80u);
  sub_4739F0(Destination);
  if ( (unsigned __int8)sub_473C50(0) != 0 )
  {
    if ( dword_ABE154 == nullptr )
    {
      v6 = operator new(4u);
      if ( v6 != nullptr )
        v7 = (void *)unknown_libname_27(v6);
      else
        v7 = nullptr;
      dword_ABE154 = v7;
    }
    if ( (unsigned __int8)sub_641DB0(Destination) != 0 )
    {
      sub_65CA80(ExistingFileName);
      sub_7B05C0(&unk_885780);
      v8 = dword_ABE154;
      if ( dword_ABE154 != nullptr )
      {
        sub_6406F0(dword_ABE154);
        operator delete(v8);
      }
      dword_ABE154 = nullptr;
      sub_65CA00(v17);
      goto LABEL_39;
    }
    v9 = dword_ABE154;
    if ( dword_ABE154 != nullptr )
    {
      sub_6406F0(dword_ABE154);
      operator delete(v9);
    }
    dword_ABE154 = nullptr;
  }
  off_82AF14 = a2;
  dword_ABDFEC = (int)a2;
  if ( dword_ABE04C == -1 )
    dword_ABE04C = sub_65C7E0(dword_886B88, 0, 0xFFFF);
  sub_598960(dword_ABDFD8, 1, hDlg);
  sub_641140(dword_ABE154);
  if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
    sub_5E7EB0(dword_ABE154);
  if ( dword_ABE150 != 0 )
    (**(void (__thiscall ***)(int, int))dword_ABE150)(dword_ABE150, 1);
  v10 = (char *)operator new(0x178u);
  if ( v10 != nullptr )
    v11 = sub_595680(v10);
  else
    v11 = nullptr;
  dword_ABE150 = (int)v11;
  qmemcpy(v11, dword_ABDFD8, 376);
  sub_686700(aRandommap);
  LOBYTE(v12) = 0;
  sub_532100(v12);
  v13 = dword_ABE154;
  if ( dword_ABE154 != nullptr )
  {
    if ( *(_DWORD *)dword_ABE154 != 0 )
    {
      sub_65CA80(ExistingFileName);
      sub_7B05C0(&unk_885780);
      if ( FindFirstFileA(PathName, &FindFileData) == (HANDLE)-1 )
        CreateDirectoryA(PathName, nullptr);
      CopyFileA(ExistingFileName, Destination, false);
      sub_595CE0();
      sub_65CA00(v17);
      v13 = dword_ABE154;
    }
    if ( v13 != nullptr )
    {
      sub_6406F0(v13);
      operator delete(v13);
    }
    dword_ABE154 = nullptr;
  }
  if ( dword_ABE150 != 0 )
  {
    (**(void (__thiscall ***)(int, int))dword_ABE150)(dword_ABE150, 1);
    dword_ABE150 = 0;
  }
LABEL_39:
  v18 = &CCFileClass::`vftable';
  v20 = 0;
  sub_43AE50(v19);
  v18 = (void **)&off_7E1668;
  sub_431B80(&v18);
  v15[0] = &rc_ptr<WDTTerritory>::`vftable';
  return sub_65D460(v15);
}
