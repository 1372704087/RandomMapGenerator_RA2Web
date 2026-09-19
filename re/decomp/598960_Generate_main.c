// 0x598960 Generate_main size=BCA

char __thiscall sub_598960(int *this, char a2, HWND hDlg)
{
  HWND DlgItem; // eax
  int v5; // eax
  int v6; // ecx
  int v7; // eax
  int i; // esi
  int j; // edi
  int v10; // esi
  int v11; // eax
  bool v12; // al
  int v13; // eax
  int k; // eax
  int v15; // ecx
  int v16; // eax
  int m; // edi
  _DWORD *v18; // esi
  int v19; // eax
  void *v20; // eax
  int n; // eax
  void (__stdcall *v22)(HWND, UINT, WPARAM, LPARAM); // esi
  int ii; // eax
  int *v24; // edi
  int jj; // eax
  _DWORD *v26; // eax
  int kk; // eax
  int mm; // edi
  _DWORD *v29; // esi
  int v30; // eax
  char result; // al
  HWND v32; // eax
  bool v33; // [esp+11h] [ebp-415h]
  _DWORD *v34; // [esp+12h] [ebp-414h] BYREF
  int *v35; // [esp+16h] [ebp-410h]
  _DWORD v36[6]; // [esp+1Ah] [ebp-40Ch]

  v35 = this;
  if ( off_82AF14 != nullptr )
    off_82AF14();
  qmemcpy(&unk_ABE890, (const void *)sub_65C6D0(*(this + 29)), 0x3F4u);
  LOBYTE(v36[0]) = 0;
  v36[2] = 0;
  v36[3] = 0;
  v36[4] = sub_598000;
  qmemcpy(&byte_ABDFB8, v36, 24);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  v33 = *((_BYTE *)dword_A8B230 + 13720) == 0;
  if ( *((_BYTE *)dword_A8B230 + 13720) == 0 )
  {
    sub_642A60(0, 1079574528, 1, hDlg);
    sub_642C20(aProgbar2Shp, 0, 0);
    sub_642C80(-1, -1, 0, 0, 1);
    sub_643AE0(NAN);
    DlgItem = GetDlgItem(hDlg, 1592);
    if ( DlgItem != nullptr )
      ShowWindow(DlgItem, 5);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgInitRandomM);
  sub_599650(this, a2);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  ++dword_A8E7AC;
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    SendMessageA(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_5981F0(this);
  nullsub_1(aRmgSeedingWate);
  v5 = *(this + 15);
  if ( v5 == 3 || v5 == 4 )
  {
    if ( *(this + 19) != 0 )
      sub_59C580(this);
  }
  else
  {
    sub_59A6C0(this);
  }
  sub_59C630();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(154);
  else
    sub_643C50(0, 55.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    SendMessageA(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(159);
  else
    sub_643C50(0, 60.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    SendMessageA(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgInitRegions);
  if ( dword_ABED10 != nullptr )
  {
    v6 = dword_89C2DC * dword_89C2DC;
    if ( dword_89C2DC * dword_89C2DC > 0 )
    {
      v7 = 0;
      do
      {
        *(_DWORD *)((char *)dword_ABED10 + v7 + 56) = -1;
        *(_DWORD *)((char *)dword_ABED10 + v7 + 60) = -1;
        v7 += 80;
        --v6;
      }
      while ( v6 != 0 );
    }
  }
  for ( i = dword_ABDFA0 - 1; i >= 0; --i )
  {
    v6 = *((_DWORD *)dword_ABDF94 + i);
    if ( v6 != 0 )
      sub_5AC290((void *)v6, 1);
  }
  dword_ABED14 = 0;
  sub_58CF90((void *)v6);
  for ( j = 0; j < dword_ABDFA0; ++j )
  {
    v10 = *((_DWORD *)dword_ABDF94 + j);
    if ( *(_BYTE *)(v10 + 20) != 0 )
    {
      v11 = v35[15];
      v12 = v11 == 3 || v11 == 4;
      sub_58E740(*((_DWORD **)dword_ABDF94 + j), (*(_DWORD *)(v10 + 12) > 8000) + !v12 + 4);
      sub_58E9B0((_DWORD *)v10);
    }
  }
  sub_58D010(0);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(164);
  else
    sub_643C50(0, 65.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgMakingRegio);
  v13 = v35[15];
  if ( v13 == 4 || v13 == 3 )
  {
    sub_58EBC0();
    sub_58EF10();
    sub_5A19E0();
    sub_578E60(0, -1);
    sub_5A17F0();
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(169);
  else
    sub_643C50(0, 70.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    SendMessageA(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_59B740();
  nullsub_1(aRmgRecalculati);
  sub_578350(&stru_87F7E8);
  for ( k = sub_578290(&stru_87F7E8); k != 0; k = sub_578290(&stru_87F7E8) )
    sub_47D2B0(k, -1);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(174);
  else
    sub_643C50(0, 75.0, NAN);
  nullsub_1(aRmgCreatingSta);
  do
  {
    while ( sub_594B50() == 0 )
      ;
  }
  while ( sub_5A1FB0(v35) == 0 );
  nullsub_1(aRmgAddingTechB);
  if ( v35[15] != 0 )
    sub_5A95B0(v35);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgCreatingTib);
  sub_5A23A0(v35);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( dword_ABED10 != nullptr )
  {
    v15 = dword_89C2DC * dword_89C2DC;
    if ( dword_89C2DC * dword_89C2DC > 0 )
    {
      v16 = 0;
      do
      {
        *(_DWORD *)((char *)dword_ABED10 + v16 + 56) = -1;
        *(_DWORD *)((char *)dword_ABED10 + v16 + 60) = -1;
        v16 += 80;
        --v15;
      }
      while ( v15 != 0 );
    }
  }
  for ( m = dword_ABDFA0 - 1; m >= 0; --m )
  {
    v18 = *((_DWORD **)dword_ABDF94 + m);
    if ( v18 != nullptr )
    {
      if ( *v18 != 0 )
      {
        (**(void (__thiscall ***)(_DWORD, int))*v18)(*v18, 1);
        *v18 = 0;
      }
      v34 = v18;
      v19 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v34);
      if ( v19 != -1 )
        sub_5AD790(v19);
      v20 = (void *)v18[11];
      v18[10] = &VectorClass<Cell>::`vftable';
      if ( v20 != nullptr && *((_BYTE *)v18 + 53) != 0 )
      {
        operator delete(v20);
        v18[11] = 0;
      }
      *((_BYTE *)v18 + 53) = 0;
      v18[12] = 0;
      operator delete(v18);
    }
  }
  dword_ABED14 = 0;
  nullsub_1(aRmgRecalculati);
  sub_578350(&stru_87F7E8);
  for ( n = sub_578290(&stru_87F7E8); n != 0; n = sub_578290(&stru_87F7E8) )
    sub_47D2B0(n, -1);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(179);
  else
    sub_643C50(0, 80.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    v22 = (void (__stdcall *)(HWND, UINT, WPARAM, LPARAM))SendMessageA;
    SendMessageA(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  else
  {
    v22 = (void (__stdcall *)(HWND, UINT, WPARAM, LPARAM))SendMessageA;
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(184);
  else
    sub_643C50(0, 85.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    v22(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgRecalculati);
  sub_578350(&stru_87F7E8);
  for ( ii = sub_578290(&stru_87F7E8); ii != 0; ii = sub_578290(&stru_87F7E8) )
    sub_47D2B0(ii, -1);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgCreatingHil);
  v24 = v35;
  sub_5A35F0(v35);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(189);
  else
    sub_643C50(0, 90.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    v22(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgCreatingLat);
  if ( v24[14] != 0 )
  {
    sub_578350(&stru_87F7E8);
    for ( jj = sub_578290(&stru_87F7E8); jj != 0; jj = sub_578290(&stru_87F7E8) )
    {
      v34 = *(_DWORD **)(jj + 36);
      v26 = (char *)dword_ABED10 + 80 * (__int16)v34 + 80 * dword_89C2DC * SHIWORD(v34);
      v26[10] = 1202590843;
      v26[11] = 1064598241;
      v26[8] = -755914244;
      v26[9] = 1062232653;
    }
    sub_5A4280(v24);
  }
  else
  {
    sub_5A38C0(v24);
    sub_5A3AE0(v24);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(194);
  else
    sub_643C50(0, 95.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( a2 != 0 )
  {
    sub_641140(dword_ABE154);
    v22(hDlg, 0xFu, 0, 0);
    if ( dword_A8B238 == 4 && dword_A8B244 == 3 )
      sub_5E7EB0(dword_ABE154);
  }
  --dword_A8E7AC;
  if ( off_82AF14 != nullptr )
    off_82AF14();
  nullsub_1(aRmgRecalculati);
  sub_578350(&stru_87F7E8);
  for ( kk = sub_578290(&stru_87F7E8); kk != 0; kk = sub_578290(&stru_87F7E8) )
    sub_47D2B0(kk, -1);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_722D00();
  sub_722240();
  nullsub_1(aRmgCleanup);
  v24[193] = 0;
  v24[194] = 0;
  if ( dword_ABED10 != nullptr )
  {
    operator delete(dword_ABED10);
    dword_ABED10 = nullptr;
  }
  for ( mm = dword_ABDFA0 - 1; mm >= 0; --mm )
  {
    v29 = *((_DWORD **)dword_ABDF94 + mm);
    if ( v29 != nullptr )
    {
      if ( *v29 != 0 )
      {
        (**(void (__thiscall ***)(_DWORD, int))*v29)(*v29, 1);
        *v29 = 0;
      }
      v34 = v29;
      v30 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v34);
      if ( v30 != -1 )
        sub_5AD790(v30);
      v29[10] = &VectorClass<Cell>::`vftable';
      sub_42F7C0(v29 + 10);
      operator delete(v29);
    }
  }
  dword_ABED14 = 0;
  sub_568BB0(1);
  nullsub_1(aRmgComputeRada);
  sub_654490(&stru_87F7E8, (int)&dword_87F8E4);
  sub_654650((int)&stru_87F7E8, 0);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(199);
  else
    sub_643C50(0, 100.0, NAN);
  nullsub_1(aRmgDone);
  result = v33;
  if ( v33 )
  {
    v32 = GetDlgItem(hDlg, 1592);
    if ( v32 != nullptr )
      ShowWindow(v32, 0);
    if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
      sub_69AE90(99);
    else
      sub_643C50(0, 0.0, NAN);
    return sub_643E70(&dword_AC4F58);
  }
  return result;
}
