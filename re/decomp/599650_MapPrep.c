// 0x599650 MapPrep size=101C

int __thiscall sub_599650(int *this, char a2)
{
  int v3; // eax
  double v4; // st7
  double v5; // st7
  double v6; // st7
  int v7; // eax
  int v8; // eax
  int v9; // ecx
  double v10; // rdi
  int v11; // edx
  int *v12; // eax
  _DWORD *v13; // eax
  int v14; // eax
  int v15; // eax
  int *v16; // esi
  void *v17; // eax
  int v18; // eax
  _DWORD *v19; // eax
  int v20; // ecx
  int v21; // edi
  void (*v22)(void); // eax
  int v23; // esi
  int v24; // eax
  int v25; // edi
  int v26; // eax
  int v27; // esi
  int v28; // eax
  void *v29; // eax
  IPersistStream *v30; // eax
  int i; // eax
  int v32; // ecx
  int j; // eax
  int v34; // ecx
  int k; // eax
  int v36; // ecx
  int m; // eax
  int v38; // ecx
  int n; // eax
  int *v40; // eax
  _DWORD *v41; // eax
  int v42; // eax
  int v43; // eax
  int v44; // esi
  int *v45; // edi
  void (*v46)(void); // eax
  int v47; // esi
  int v48; // edx
  int v49; // ecx
  int v50; // edx
  int v51; // ecx
  int *v52; // edi
  int v53; // esi
  char *v54; // eax
  int v55; // esi
  char *v56; // ecx
  int v57; // edx
  int ii; // eax
  _DWORD *v59; // esi
  int v60; // eax
  void *v61; // eax
  int v62; // eax
  int v63; // eax
  int v64; // eax
  int v65; // eax
  const wchar_t *v66; // eax
  bool v68; // [esp+27h] [ebp-A1h]
  float v69; // [esp+28h] [ebp-A0h]
  int v70; // [esp+28h] [ebp-A0h]
  int v71; // [esp+28h] [ebp-A0h]
  int jj; // [esp+28h] [ebp-A0h]
  int v73; // [esp+2Ch] [ebp-9Ch] BYREF
  double v74[2]; // [esp+30h] [ebp-98h] BYREF
  int *v75; // [esp+40h] [ebp-88h]
  int v76[2]; // [esp+44h] [ebp-84h] BYREF
  int v77; // [esp+4Ch] [ebp-7Ch]
  int v78; // [esp+50h] [ebp-78h]
  int v79[4]; // [esp+54h] [ebp-74h] BYREF
  _DWORD v80[3]; // [esp+64h] [ebp-64h] BYREF
  char v81[28]; // [esp+70h] [ebp-58h] BYREF
  char v82[20]; // [esp+8Ch] [ebp-3Ch] BYREF
  int v83; // [esp+A0h] [ebp-28h]
  char v84; // [esp+A4h] [ebp-24h]
  char v85[12]; // [esp+BCh] [ebp-Ch] BYREF

  v75 = this;
  *(float *)&v73 = (double)*(this + 25) * 0.33333334;
  v69 = (double)*(this + 26) * 0.33333334;
  sub_5981F0(this);
  v3 = *(this + 15);
  if ( v3 == 3 || v3 == 4 )
  {
    v5 = v69;
  }
  else
  {
    if ( *(float *)&v73 >= 1.2 )
      v4 = 1.2;
    else
      v4 = *(float *)&v73;
    *(float *)&v73 = v4;
    if ( v69 >= 1.2 )
      v5 = 1.2;
    else
      v5 = v69;
  }
  *(this + 96) = sub_7C5F00(v5);
  v7 = sub_7C5F00(v6);
  v77 = *(this + 96);
  v79[2] = v77 + 4;
  *(this + 97) = v7;
  v79[0] = 0;
  v79[1] = 0;
  v79[3] = v7 + 12;
  v76[0] = 2;
  v76[1] = 5;
  v78 = v7;
  *(this + 195) = 4;
  v80[1] = 0;
  v80[2] = 0;
  sub_49E8E0(v81);
  sub_49EA10(v82);
  v83 = 0;
  v84 = 0;
  v80[0] = &CCINIClass::`vftable';
  sub_5257C0(0, 0);
  v8 = *(this + 14);
  *(this + 195) = 4;
  sub_528660(&off_81FFF0, aTheater, &aTemperate[112 * v8]);
  sub_527C10(&off_81FFF0, aSize, (int)v79);
  sub_527C10(&off_81FFF0, aLocalsize, (int)v76);
  sub_5275C0(&off_81FFF0, aLevel, *(this + 195), 0);
  sub_528660((void *)(*(_DWORD *)dword_A83C9C + 36), aTechlevel, a0);
  sub_528660(aBasic, aPlayer, (char *)(*(_DWORD *)dword_A83C9C + 36));
  if ( *(this + 14) != 0 )
    v9 = *(this + 113);
  else
    v9 = *(this + 106);
  v74[0] = (double)*(int *)(v9 + 4 * *(this + 18)) * 0.01;
  v10 = v74[0];
  sub_5285B0(aLighting, aAmbient, v74[0]);
  sub_5285B0(aLighting, aRedtint, 1.0);
  sub_5285B0(aLighting, aGreentint, 1.0);
  sub_5285B0(aLighting, aBluetint, 1.0);
  sub_5285B0(aLighting, aGround, 0.0);
  LODWORD(v74[0]) = *(_DWORD *)(v75[99] + 4 * v75[18]) / 100;
  sub_5285B0(aLighting, aLevel, (double)SLODWORD(v74[0]));
  sub_5285B0(aLighting, aIonambient, v10);
  sub_5285B0(aLighting, aIonred, 0.3);
  sub_5285B0(aLighting, aIongreen, 0.4);
  sub_5285B0(aLighting, aIonblue, 0.75);
  sub_5285B0(aLighting, aIonground, 0.0);
  sub_5285B0(aLighting, aIonlevel, 0.0);
  if ( *((_BYTE *)dword_A8B230 + 13720) == 0 )
    sub_643C50(0, 1.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_722390();
  sub_722E50();
  if ( a2 == 0 )
  {
    ++dword_A8E7AC;
    sub_686700(&byte_889F64);
    if ( byte_A8ED6B != 0 )
      sub_6851F0();
    LOBYTE(v11) = 1;
    sub_686B20(v80, v11);
    sub_684C30();
    HIWORD(v70) = dword_87F8E0 / 2 + dword_87F8DC / 2;
    LOWORD(v70) = HIWORD(v70) + 1;
    sub_68BF50((char *)dword_A8B230, 700, v70);
    v12 = sub_68BCC0((char *)dword_A8B230, v74, 700);
    sub_68BF50((char *)dword_A8B230, *((_DWORD *)dword_A8B230 + 131), *v12);
    v13 = sub_68BCC0((char *)dword_A8B230, v74, *((_DWORD *)dword_A8B230 + 131));
    v14 = sub_5657A0(v13);
    *(_DWORD *)(v14 + 320) |= 4u;
    v15 = sub_68BD00(v74, *((_DWORD *)dword_A8B230 + 131));
    sub_653F70(v15);
    goto LABEL_152;
  }
  sub_683610(dword_A8B230);
  v16 = v75;
  if ( v75[95] == 0 )
  {
    v17 = operator new(4u);
    if ( v17 != nullptr )
      v18 = unknown_libname_27(v17);
    else
      v18 = 0;
    v75[95] = v18;
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(101);
  else
    sub_643C50(0, 2.0, NAN);
  v19 = (_DWORD *)v16[94];
  v20 = v16[14];
  v21 = *((_DWORD *)dword_A8B230 + 1174);
  LODWORD(v74[0]) = v20;
  v68 = true;
  v71 = v21;
  if ( v19 != nullptr )
  {
    v21 = v19[14];
    v71 = v21;
    if ( v19[25] == v16[25] && v19[26] == v16[26] && v21 == v20 )
      v68 = v19[20] != v16[20];
  }
  v22 = (void (*)(void))off_82AF14;
  if ( off_82AF14 != nullptr )
  {
    off_82AF14();
    v22 = (void (*)(void))off_82AF14;
    v20 = LODWORD(v74[0]);
  }
  if ( v16[94] == 0 || v20 != v21 || v68 )
  {
    v23 = dword_A8E978 - 1;
    if ( dword_A8E978 - 1 >= 0 )
    {
      do
      {
        if ( (*(int (__stdcall **)(int))(*(_DWORD *)(*((_DWORD *)dword_A8E96C + v23) + 4) + 12))(*((_DWORD *)dword_A8E96C
                                                                                                 + v23) + 4) == 18
          && v23 < dword_A8E978 )
        {
          v24 = v23;
          if ( v23 < --dword_A8E978 )
          {
            do
            {
              ++v24;
              *((_DWORD *)dword_A8E96C + v24 - 1) = *((_DWORD *)dword_A8E96C + v24);
            }
            while ( v24 < dword_A8E978 );
          }
        }
        --v23;
      }
      while ( v23 >= 0 );
      v22 = (void (*)(void))off_82AF14;
    }
    if ( v22 != nullptr )
      v22();
    sub_534450();
    if ( off_82AF14 != nullptr )
      off_82AF14();
    v25 = 0;
    if ( dword_A8ED38 > 0 )
    {
      v26 = dword_A8E970;
      do
      {
        v27 = *((_DWORD *)dword_A8ED2C + v25);
        if ( dword_A8E978 < v26 )
          goto LABEL_57;
        if ( (byte_A8E975 != 0 || v26 == 0) && dword_A8E97C > 0 )
        {
          if ( (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_A8E968 + 8))(
                 &dword_A8E968,
                 dword_A8E97C + v26,
                 0) != 0 )
          {
LABEL_57:
            v28 = dword_A8E978++;
            *((_DWORD *)dword_A8E96C + v28) = v27;
          }
          v26 = dword_A8E970;
        }
        ++v25;
      }
      while ( v25 < dword_A8ED38 );
    }
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(104);
  else
    sub_643C50(0, 5.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( v68 )
  {
    sub_5BDF50(&stru_87F7E8);
    sub_653F50(v79, 1, 0, 1);
    sub_654490(&stru_87F7E8, (int)v76);
    if ( pPStm != nullptr )
      ((void (__thiscall *)(LPPERSISTSTREAM, int))pPStm->lpVtbl[1].QueryInterface)(pPStm, 1);
    v29 = operator new(0xE18u);
    if ( v29 != nullptr )
      v30 = (IPersistStream *)sub_6D1C20(v29);
    else
      v30 = nullptr;
    pPStm = v30;
    sub_6DA980(v30);
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(109);
  else
    sub_643C50(0, 10.0, NAN);
  for ( i = dword_8B4118; dword_8B4118 > 0; i = dword_8B4118 )
  {
    v32 = *((_DWORD *)dword_8B410C + i - 1);
    if ( v32 != 0 )
      (*(void (__thiscall **)(int, int))(*(_DWORD *)v32 + 32))(v32, 1);
  }
  for ( j = dword_A83DF8; dword_A83DF8 > 0; j = dword_A83DF8 )
  {
    v34 = *((_DWORD *)dword_A83DEC + j - 1);
    if ( v34 != 0 )
      (*(void (__thiscall **)(int, int))(*(_DWORD *)v34 + 32))(v34, 1);
  }
  for ( k = dword_A8EB50; dword_A8EB50 > 0; k = dword_A8EB50 )
  {
    v36 = *((_DWORD *)dword_A8EB44 + k - 1);
    if ( v36 != 0 )
      (*(void (__thiscall **)(int, int))(*(_DWORD *)v36 + 32))(v36, 1);
  }
  for ( m = dword_A8E998; dword_A8E998 > 0; m = dword_A8E998 )
  {
    v38 = *((_DWORD *)dword_A8E98C + m - 1);
    if ( v38 != 0 )
      (*(void (__thiscall **)(int, int))(*(_DWORD *)v38 + 32))(v38, 1);
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_578350(&stru_87F7E8);
  for ( n = sub_578290(&stru_87F7E8); n != 0; n = sub_578290(&stru_87F7E8) )
  {
    *(_BYTE *)(n + 284) = 0;
    *(_BYTE *)(n + 283) = 4;
    *(_DWORD *)(n + 56) = 0;
    *(_BYTE *)(n + 282) = 0;
    *(_DWORD *)(n + 68) = -1;
    *(_BYTE *)(n + 286) = 0;
  }
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(114);
  else
    sub_643C50(0, 15.0, NAN);
  sub_56D6E0(&stru_87F7E8);
  sub_56C510(&stru_87F7E8);
  sub_581F50(&stru_87F7E8);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(119);
  else
    sub_643C50(0, 20.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  sub_68BD60(dword_A8B230);
  HIWORD(v73) = dword_87F8E0 / 2 + dword_87F8DC / 2;
  LOWORD(v73) = HIWORD(v73) + 1;
  sub_68BF50((char *)dword_A8B230, 700, v73);
  v40 = sub_68BCC0((char *)dword_A8B230, &v73, 700);
  sub_68BF50((char *)dword_A8B230, 699, *v40);
  v41 = sub_68BCC0((char *)dword_A8B230, &v73, 699);
  v42 = sub_5657A0(v41);
  *(_DWORD *)(v42 + 320) |= 4u;
  v43 = sub_68BD00(v85, 699);
  sub_653F70(v43);
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(124);
  else
    sub_643C50(0, 25.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  v44 = LODWORD(v74[0]);
  ++dword_A8E7AC;
  if ( LODWORD(v74[0]) != *((_DWORD *)dword_A8B230 + 1174) )
  {
    sub_5349C0(LODWORD(v74[0]));
    *((_DWORD *)dword_A8B230 + 1174) = v44;
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(129);
  else
    sub_643C50(0, 30.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  v45 = v75;
  if ( v75[94] == 0 || v44 != v71 || v68 )
  {
    sub_6686C0(dword_887048);
    sub_689880(dword_887048);
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(134);
  else
    sub_643C50(0, 35.0, NAN);
  v46 = (void (*)(void))off_82AF14;
  if ( off_82AF14 != nullptr )
  {
    off_82AF14();
    v46 = (void (*)(void))off_82AF14;
  }
  if ( v45[94] == 0 || v44 != v71 || v68 )
  {
    if ( dword_A80238 == 0 )
    {
      v47 = 0;
      if ( dword_A83CA8 > 0 )
      {
        do
        {
          if ( operator new(0x160B8u) != nullptr )
            sub_4F54A0(*((_DWORD *)dword_A83C9C + v47));
          sub_500B40(v80);
          ++v47;
        }
        while ( v47 < dword_A83CA8 );
        v46 = (void (*)(void))off_82AF14;
      }
    }
    if ( v46 != nullptr )
      v46();
    sub_71DCA0(*((_DWORD *)dword_A8B230 + 1174));
    v49 = *((_DWORD *)dword_A8B230 + 1174);
    if ( v49 == dword_822CF8 )
    {
      sub_547110();
    }
    else
    {
      LOBYTE(v48) = 1;
      sub_545150(v49, v48);
    }
    sub_5FE620(*((_DWORD *)dword_A8B230 + 1174));
    if ( off_82AF14 != nullptr )
    {
      off_82AF14();
      if ( off_82AF14 != nullptr )
      {
        off_82AF14();
        if ( off_82AF14 != nullptr )
          off_82AF14();
      }
    }
    sub_45E970(*((_DWORD *)dword_A8B230 + 1174));
    if ( off_82AF14 != nullptr )
      off_82AF14();
    sub_427940(*((_DWORD *)dword_A8B230 + 1174));
    if ( off_82AF14 != nullptr )
      off_82AF14();
    sub_6B5490(*((_DWORD *)dword_A8B230 + 1174));
    if ( off_82AF14 != nullptr )
      off_82AF14();
    LOBYTE(v50) = 1;
    LOBYTE(v51) = 0;
    sub_546DA0(v51, v50);
  }
  dword_822CF8 = *((_DWORD *)dword_A8B230 + 1174);
LABEL_152:
  v52 = v75;
  --dword_A8E7AC;
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(139);
  else
    sub_643C50(0, 40.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  if ( dword_ABED10 != nullptr )
    operator delete(dword_ABED10);
  v53 = dword_89C2DC * dword_89C2DC;
  v54 = (char *)operator new(80 * dword_89C2DC * dword_89C2DC);
  if ( v54 != nullptr )
  {
    v55 = v53 - 1;
    if ( v55 >= 0 )
    {
      v56 = v54 + 8;
      v57 = v55 + 1;
      do
      {
        *((_WORD *)v56 - 4) = 0;
        *((_WORD *)v56 - 3) = 0;
        *(_DWORD *)v56 = 0;
        *((_DWORD *)v56 + 2) = 0;
        *((_DWORD *)v56 + 4) = 0;
        *((_DWORD *)v56 + 6) = 0;
        *((_DWORD *)v56 + 8) = 0;
        *((_DWORD *)v56 + 10) = 0;
        *((_DWORD *)v56 + 1) = 0;
        *((_DWORD *)v56 + 3) = 0;
        *((_DWORD *)v56 + 5) = 0;
        *((_DWORD *)v56 + 7) = 0;
        *((_DWORD *)v56 + 9) = 0;
        *((_DWORD *)v56 + 11) = 0;
        *((_DWORD *)v56 + 12) = 0;
        *((_DWORD *)v56 + 13) = 0;
        *((_DWORD *)v56 + 14) = -1;
        v56[60] = 0;
        v56[61] = 0;
        v56[62] = 0;
        v56[63] = 0;
        v56[64] = 0;
        v56[65] = 0;
        v56[66] = 1;
        v56[67] = 0;
        v56 += 80;
        --v57;
      }
      while ( v57 != 0 );
    }
    dword_ABED10 = v54;
  }
  else
  {
    dword_ABED10 = nullptr;
  }
  sub_578350(&stru_87F7E8);
  for ( ii = sub_578290(&stru_87F7E8); ii != 0; ii = sub_578290(&stru_87F7E8) )
  {
    LODWORD(v74[0]) = *(_DWORD *)(ii + 36);
    *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v74[0]) + 20 * dword_89C2DC * SWORD1(v74[0])) = LODWORD(v74[0]);
    *(_BYTE *)(ii + 283) = *((_BYTE *)v52 + 780);
  }
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(144);
  else
    sub_643C50(0, 45.0, NAN);
  if ( off_82AF14 != nullptr )
    off_82AF14();
  dword_ABED14 = 0;
  for ( jj = dword_ABDFA0 - 1; jj >= 0; --jj )
  {
    v59 = *((_DWORD **)dword_ABDF94 + jj);
    if ( v59 != nullptr )
    {
      if ( *v59 != 0 )
      {
        (**(void (__thiscall ***)(_DWORD, int))*v59)(*v59, 1);
        *v59 = 0;
      }
      LODWORD(v74[0]) = v59;
      v60 = (*(int (__thiscall **)(int *, double *))(dword_ABDF90 + 16))(&dword_ABDF90, v74);
      if ( v60 != -1 )
        sub_5AD790(v60);
      v61 = (void *)v59[11];
      v59[10] = &VectorClass<Cell>::`vftable';
      if ( v61 != nullptr && *((_BYTE *)v59 + 53) != 0 )
      {
        operator delete(v61);
        v59[11] = 0;
      }
      *((_BYTE *)v59 + 53) = 0;
      v59[12] = 0;
      operator delete(v59);
    }
  }
  v52[193] = 0;
  v52[194] = 0;
  *(_QWORD *)&v74[0] = (unsigned int)sub_65C780(&unk_ABE890);
  *((_BYTE *)v52 + 784) = (double)*(__int64 *)&v74[0] * 2.328306437080797e-10 < 0.25;
  sub_655A90(&stru_87F7E8);
  sub_654490(&stru_87F7E8, (int)v76);
  sub_6558D0(&stru_87F7E8);
  sub_654650((int)&stru_87F7E8, 0);
  if ( v52[14] != 0 )
    v62 = *(_DWORD *)(v52[113] + 4 * v52[18]);
  else
    v62 = *(_DWORD *)(v52[106] + 4 * v52[18]);
  *((_DWORD *)dword_A8B230 + 3402) = v62;
  *((_DWORD *)dword_A8B230 + 3409) = *(_DWORD *)(v52[99] + 4 * v52[18]);
  if ( v52[14] != 0 )
    v63 = *(_DWORD *)(v52[141] + 4 * v52[18]);
  else
    v63 = *(_DWORD *)(v52[120] + 4 * v52[18]);
  *((_DWORD *)dword_A8B230 + 3405) = v63;
  if ( v52[14] != 0 )
    v64 = *(_DWORD *)(v52[148] + 4 * v52[18]);
  else
    v64 = *(_DWORD *)(v52[127] + 4 * v52[18]);
  *((_DWORD *)dword_A8B230 + 3406) = v64;
  if ( v52[14] != 0 )
    v65 = *(_DWORD *)(v52[155] + 4 * v52[18]);
  else
    v65 = *(_DWORD *)(v52[134] + 4 * v52[18]);
  *((_DWORD *)dword_A8B230 + 3407) = v65;
  if ( *((_BYTE *)dword_A8B230 + 13720) != 0 )
    sub_69AE90(149);
  else
    sub_643C50(0, 50.0, NAN);
  if ( wcslen((const wchar_t *)v52 + 60) == 0 )
  {
    v66 = (const wchar_t *)sub_734E60(aTxtRandomMapDe, (int)aDRa2mdpostMapg, 6746);
    wcscpy((wchar_t *)v52 + 60, v66);
  }
  return sub_5256F0(v80);
}
