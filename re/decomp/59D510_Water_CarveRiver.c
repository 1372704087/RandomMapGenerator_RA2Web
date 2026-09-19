// 0x59d510 Water_CarveRiver size=1122

char __thiscall sub_59D510(int *this, int a2, long double a3, char a4)
{
  bool v4; // zf
  unsigned int v5; // edi
  unsigned int v6; // eax
  __int16 v7; // si
  unsigned int v8; // edi
  unsigned int v9; // eax
  double v10; // st7
  __int16 v11; // di
  __int16 v12; // bx
  int v13; // ebx
  long double v14; // st7
  int v15; // esi
  double v16; // st7
  unsigned int v17; // esi
  unsigned int v18; // eax
  double v19; // st6
  double v20; // st7
  int *v21; // ebx
  double v22; // st7
  __int16 v23; // si
  double v24; // st7
  __int16 v25; // ax
  int v26; // ecx
  int v27; // esi
  int v28; // edx
  double v29; // rdi
  int v30; // eax
  double v31; // st7
  _DWORD *v32; // esi
  __int16 v33; // di
  __int16 v34; // ax
  int v35; // edx
  __int16 v36; // bx
  __int16 v37; // ax
  _DWORD *v38; // eax
  bool v39; // al
  int v40; // eax
  int v41; // eax
  int v42; // ecx
  int v43; // edi
  double v44; // st7
  double v45; // st7
  long double v46; // st6
  int v47; // edi
  double v48; // st7
  double v49; // st7
  int v50; // esi
  int v51; // eax
  long double v52; // st7
  long double v53; // st7
  long double v54; // st7
  __int16 v55; // di
  __int16 v56; // ax
  int v57; // ecx
  int v58; // eax
  char v59; // al
  int v60; // esi
  int i; // eax
  int v62; // ecx
  int v63; // ecx
  int v64; // edx
  int v65; // esi
  int m; // eax
  int v67; // edx
  int v68; // ecx
  bool v69; // cc
  char v70; // al
  int v72; // esi
  int j; // eax
  char *v74; // ecx
  int v75; // esi
  int k; // eax
  char *v77; // ecx
  char v78; // [esp+Fh] [ebp-121h]
  __int16 v79; // [esp+10h] [ebp-120h] BYREF
  char v80; // [esp+13h] [ebp-11Dh]
  int v81; // [esp+14h] [ebp-11Ch]
  double v82; // [esp+18h] [ebp-118h]
  char v83; // [esp+27h] [ebp-109h]
  int v84; // [esp+28h] [ebp-108h]
  double v85; // [esp+30h] [ebp-100h]
  int *v86; // [esp+3Ch] [ebp-F4h]
  long double v87; // [esp+40h] [ebp-F0h]
  int v88; // [esp+4Ch] [ebp-E4h]
  int v89; // [esp+50h] [ebp-E0h] BYREF
  double v90; // [esp+58h] [ebp-D8h] BYREF
  int v91; // [esp+60h] [ebp-D0h] BYREF
  double v92; // [esp+68h] [ebp-C8h]
  int v93; // [esp+74h] [ebp-BCh] BYREF
  double v94; // [esp+78h] [ebp-B8h]
  long double v95; // [esp+80h] [ebp-B0h]
  double v96; // [esp+88h] [ebp-A8h]
  double v97; // [esp+90h] [ebp-A0h]
  double v98; // [esp+98h] [ebp-98h]
  __int16 v99; // [esp+A0h] [ebp-90h] BYREF
  int v100; // [esp+A2h] [ebp-8Eh]
  long double v101; // [esp+A8h] [ebp-88h]
  double v102; // [esp+B0h] [ebp-80h] BYREF
  long double v103; // [esp+B8h] [ebp-78h]
  double v104; // [esp+C0h] [ebp-70h] BYREF
  _WORD v105[2]; // [esp+CCh] [ebp-64h] BYREF
  int v106[2]; // [esp+D0h] [ebp-60h] BYREF
  int v107; // [esp+D8h] [ebp-58h]
  int v108; // [esp+DCh] [ebp-54h]
  _WORD v109[2]; // [esp+E0h] [ebp-50h] BYREF
  int v110; // [esp+E4h] [ebp-4Ch]
  double v111; // [esp+E8h] [ebp-48h]
  long double v112; // [esp+F0h] [ebp-40h]
  double v113; // [esp+F8h] [ebp-38h]
  long double v114; // [esp+100h] [ebp-30h]
  __int64 v115; // [esp+108h] [ebp-28h]
  long double v116; // [esp+110h] [ebp-20h]
  long double v117; // [esp+118h] [ebp-18h]
  double v118; // [esp+120h] [ebp-10h]
  long double v119; // [esp+128h] [ebp-8h]

  v83 = a4;
  v4 = *(_WORD *)a2 == 0;
  v86 = this;
  v78 = 1;
  v88 = 0;
  if ( !v4 || *(_WORD *)(a2 + 2) != 0 )
  {
    v93 = *(_DWORD *)a2;
    v103 = a3;
  }
  else
  {
    LOWORD(v100) = dword_87F8DC;
    LOWORD(v89) = dword_87F8E0;
    HIWORD(v89) = dword_87F8E0;
    LOWORD(v84) = dword_87F8E0 + dword_87F8DC + 1;
    HIWORD(v84) = dword_87F8E0;
    v91 = (unsigned __int16)(v84 - 2);
    do
    {
      *(_QWORD *)&v82 = (unsigned int)sub_65C780(&unk_ABE890);
      LODWORD(v90) = sub_7C5F00((double)*(__int64 *)&v82 * 9.31322574832319e-10);
    }
    while ( LODWORD(v90) > 3 );
    v5 = dword_87F8DC - 1;
    *(_QWORD *)&v82 = (unsigned int)dword_87F8DC;
    v97 = (double)(unsigned int)dword_87F8DC;
    do
    {
      *(_QWORD *)&v82 = (unsigned int)sub_65C780(&unk_ABE890);
      v6 = sub_7C5F00((double)*(__int64 *)&v82 * v97 * 2.328306437080797e-10);
      v7 = v6;
    }
    while ( v6 > v5 );
    v8 = dword_87F8E0 - 1;
    *(_QWORD *)&v82 = (unsigned int)dword_87F8E0;
    v97 = (double)(unsigned int)dword_87F8E0;
    do
    {
      *(_QWORD *)&v82 = (unsigned int)sub_65C780(&unk_ABE890);
      v9 = sub_7C5F00((double)*(__int64 *)&v82 * v97 * 2.328306437080797e-10);
    }
    while ( v9 > v8 );
    HIWORD(v89) = -v7;
    LOWORD(v81) = v7 + 1;
    v10 = 5.497787143782138 - (double)SLODWORD(v90) * 1.570796326794897;
    v98 = 0.5235987755982988;
    HIWORD(v81) = v100 - v7;
    v106[0] = v81;
    v101 = v10 + 0.7853981633974483;
    LOWORD(v81) = v91 - v9;
    v11 = HIWORD(v84);
    v12 = HIWORD(v84);
    HIWORD(v84) = -v7;
    HIWORD(v81) = v12 - v9;
    v13 = v81;
    v85 = v10 - 0.7853981633974483;
    LOWORD(v81) = v91 - v7;
    v82 = v10;
    HIWORD(v81) = v11 + v7;
    v107 = v81;
    LOWORD(v81) = v9 + 1;
    HIWORD(v81) = v100 + v9;
    v106[1] = v13;
    v108 = v81;
    v93 = v106[LODWORD(v90)];
    if ( v10 - 0.5235987755982988 > v101 || v10 + 0.5235987755982988 < v85 )
    {
      v98 = (v101 - v85) * 0.5;
      v82 = v98 + v85;
    }
    do
    {
      do
        v14 = sub_5980C0((double *)&byte_ABDFB8) * v98 + v82;
      while ( v14 < v85 );
    }
    while ( v14 > v101 );
    v103 = v14;
  }
  v15 = SHIWORD(v93) + (__int16)v93;
  if ( v15 <= dword_ABED04
    || (__int16)v93 - SHIWORD(v93) >= dword_ABED04
    || SHIWORD(v93) - (__int16)v93 >= dword_ABED04
    || v15 > dword_ABED08 )
  {
    return 0;
  }
  v81 = 0;
  v16 = (double)v86[19] * 0.07000000000000001;
  if ( v16 < 1.0 )
    v16 = 1.0;
  v17 = sub_7C5F00(v16);
  *(_QWORD *)&v82 = v17;
  v97 = (double)v17;
  do
  {
    *(_QWORD *)&v82 = (unsigned int)sub_65C780(&unk_ABE890);
    v18 = sub_7C5F00((double)*(__int64 *)&v82 * v97 * 2.328306437080797e-10 + 1.0);
  }
  while ( v18 > v17 );
  *(_QWORD *)&v82 = v18;
  v98 = (double)v18;
  v91 = sub_7C5F00(v98) / 2;
  v19 = (double)v91;
  v118 = v19 + v20;
  *(double *)v106 = v20 - v19;
  do
  {
    *(_QWORD *)&v82 = (unsigned int)sub_65C780(&unk_ABE890);
    v84 = sub_7C5F00((double)*(__int64 *)&v82 * 0.00000002118758857743526 + 35.0);
  }
  while ( (unsigned int)v84 > 0x7D );
  v89 = SHIWORD(v93);
  v21 = v86;
  v96 = v103;
  v102 = (double)(__int16)v93 + 0.5;
  v104 = (double)SHIWORD(v93) + 0.5;
  v119 = v103 + 1.570796326794897;
  v117 = v103 - 1.570796326794897;
  v22 = 1.0;
  do
  {
    v23 = sub_7C5F00(v22);
    v25 = sub_7C5F00(v24);
    v26 = v23;
    v27 = dword_ABED04;
    v28 = v25 + v26;
    if ( v28 <= dword_ABED04 || v26 - v25 >= dword_ABED04 || v25 - v26 >= dword_ABED04 || v28 > dword_ABED08 || v78 == 0 )
      goto LABEL_100;
    v29 = v96;
    sub_4CAD00(v96);
    v95 = v22;
    sub_4CACB0(v29);
    v87 = v22;
    v30 = sub_7C5F00(v98 + 0.5);
    v80 = 1;
    LODWORD(v94) = v30 - 1;
    LOBYTE(v79) = 1;
    v31 = (double)(v30 - 1);
    v114 = v31 * v87 * 0.5;
    v92 = v102 - v114;
    v116 = v31 * v95 * 0.5;
    v85 = v104 - v116;
    if ( v30 > 0 )
    {
      v32 = dword_ABED10;
      LODWORD(v94) = v30;
      while ( 1 )
      {
        v33 = sub_7C5F00(v92);
        v34 = sub_7C5F00(v85);
        LOWORD(v90) = v34;
        v35 = v34 + v33;
        if ( v35 > dword_ABED04 )
          break;
LABEL_50:
        v43 = sub_7C5F00(v92 + v87);
        if ( sub_7C5F00(v44) != v43 )
          v80 = 0;
        v46 = v85 + v95;
        v47 = sub_7C5F00(v45);
        if ( sub_7C5F00(v48) != v47 )
          LOBYTE(v79) = 0;
        v92 = v49;
        v4 = LODWORD(v94) == 1;
        v85 = v46;
        --LODWORD(v94);
        if ( v4 )
          goto LABEL_55;
      }
      if ( v33 - v34 < dword_ABED04 && v34 - v33 < dword_ABED04 && v35 <= dword_ABED08 )
      {
        v36 = LOWORD(v90);
        v37 = LOWORD(v90);
        LOWORD(v110) = v33;
        HIWORD(v110) = LOWORD(v90);
        LODWORD(v90) = v110;
        if ( v32 == nullptr )
          goto LABEL_42;
        if ( v32[20 * v33 + 14 + 20 * dword_89C2DC * v37] == 0 )
        {
          v38 = (_DWORD *)sub_5657A0(&v90);
          v39 = sub_486380(v38);
          v32 = dword_ABED10;
          if ( v39 )
            goto LABEL_45;
        }
        if ( v32 != nullptr )
          v40 = v32[20 * SLOWORD(v90) + 14 + 20 * dword_89C2DC * SWORD1(v90)];
        else
LABEL_42:
          v40 = -1;
        if ( v40 == v86[194] )
        {
LABEL_45:
          if ( v32 != nullptr )
            v32[20 * SLOWORD(v90) + 14 + 20 * dword_89C2DC * SWORD1(v90)] = v86[194];
          v105[0] = v33;
          v105[1] = v36;
          v41 = sub_5657A0(v105);
          v42 = dword_AA0738;
          *(_BYTE *)(v41 + 282) = 0;
          *(_DWORD *)(v41 + 56) = v42;
          v32 = dword_ABED10;
          goto LABEL_49;
        }
        v78 = 0;
      }
LABEL_49:
      v21 = v86;
      goto LABEL_50;
    }
LABEL_55:
    if ( fabs(v87) >= fabs(v95) )
      v80 = 0;
    else
      LOBYTE(v79) = 0;
    if ( a4 == 0 && (v80 != 0 || (_BYTE)v79 != 0) && v88 < 1 )
    {
      LODWORD(v94) = abs32(sub_7C5F00(v96 - v103));
      if ( (double)SLODWORD(v94) < 0.7853981633974483 && *((_BYTE *)v21 + 784) != 0 && v81 > v84 )
      {
        if ( v80 != 0 )
          v50 = v95 <= 0.0 ? 6 : 2;
        else
          v50 = v87 <= 0.0 ? 4 : 0;
        LOBYTE(v79) = 0;
        v109[0] = sub_7C5F00(v92 - v87);
        v109[1] = sub_7C5F00(v85 - v95);
        v99 = sub_7C5F00(v102 - v114);
        LOWORD(v100) = sub_7C5F00(v104 - v116);
        sub_59E740(v21[194], &v99, v109, v50, &v79, &v102, &v104);
        if ( (_BYTE)v79 != 0 )
        {
          v51 = v88 + 1;
          ++v21[194];
          v88 = v51;
        }
      }
    }
    v102 = v95 + v102;
    v104 = v104 - v87;
    v115 = (unsigned int)sub_65C780(&unk_ABE890);
    if ( (double)v115 * 2.328306437080797e-10 < 0.01 && v78 != 0 && a4 == 0 && v88 == 0 )
    {
      a4 = 1;
      v112 = 0.5235987755982988;
      v87 = v96 + 1.570796326794897;
      v95 = v96 + 0.5235987755982988;
      v90 = v96 + 2.617993877991494;
      if ( v87 - 0.5235987755982988 > v90 || v87 + 0.5235987755982988 < v95 )
      {
        v112 = (v90 - v95) * 0.5;
        v87 = v112 + v95;
      }
      do
      {
        do
        {
          v52 = sub_5980C0((double *)&byte_ABDFB8);
          v94 = v52 * v112 + v87;
        }
        while ( v94 < v95 );
      }
      while ( v94 > v90 );
      LOWORD(v89) = sub_7C5F00(v92);
      HIWORD(v89) = sub_7C5F00(v85);
      v78 = sub_59D510(v21, (int)&v89, v94, 1);
    }
    if ( v81 > 5 )
    {
      v111 = 0.3141592653589793;
      v113 = 0.0;
      v92 = v119 - v96;
      v85 = v117 - v96;
      if ( v92 < -0.3141592653589793 || v85 > 0.3141592653589793 )
      {
        v111 = (v92 - v85) * 0.5;
        v113 = v111 + v85;
      }
      do
      {
        do
        {
          v53 = sub_5980C0((double *)&byte_ABDFB8);
          v87 = v53 * v111 + v113;
        }
        while ( v87 < v85 );
      }
      while ( v87 > v92 );
      v96 = v87 + v96;
    }
    if ( v91 > 0 )
    {
      v101 = 0.5;
      v82 = 0.0;
      v92 = v118 - v98;
      v85 = *(double *)v106 - v98;
      if ( v92 < -0.5 || v85 > 0.5 )
      {
        v101 = (v92 - v85) * 0.5;
        v82 = v101 + v85;
      }
      do
      {
        do
        {
          v54 = sub_5980C0((double *)&byte_ABDFB8);
          v87 = v54 * v101 + v82;
        }
        while ( v87 < v85 );
      }
      while ( v87 > v92 );
      v98 = v87 + v98;
    }
    *(_QWORD *)&v97 = (unsigned int)sub_65C780(&unk_ABE890);
    v22 = (double)*(__int64 *)&v97 * 2.328306437080797e-10;
    ++v81;
  }
  while ( v22 >= 0.005 );
  v27 = dword_ABED04;
LABEL_100:
  if ( v81 < 40 )
    v78 = 0;
  if ( v22 < 0.005 )
  {
    v55 = sub_7C5F00(v102);
    LOWORD(v90) = v55;
    v56 = sub_7C5F00(v104);
    v57 = v56;
    v79 = v56;
    v58 = v56 + v55;
    if ( v58 > v27 && v55 - v57 < v27 && v57 - v55 < v27 && v58 <= dword_ABED08 && v78 != 0 )
    {
      HIWORD(v91) = v79;
      LOWORD(v91) = LOWORD(v90);
      if ( sub_59C920(v21, &v91) == 0 )
        v78 = 0;
    }
  }
  if ( v83 == 0 && v78 != 0 )
  {
    v78 = sub_57A0C0(v21[194], 0);
    if ( v78 != 0 )
    {
      v59 = sub_5A0160(v21[194], 1, 0, 0, 512, 512, 0, 0);
      v60 = v21[194];
      v78 = v59;
      sub_578350(&stru_87F7E8);
      for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
      {
        if ( dword_ABED10 != nullptr )
          v62 = *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(i + 36) + 20 * dword_89C2DC * *(__int16 *)(i + 38) + 14);
        else
          v62 = -1;
        if ( v62 == v60 )
        {
          v63 = *(_DWORD *)(i + 56);
          if ( v63 == 0 || v63 == 0xFFFF )
            *(_DWORD *)(i + 56) = dword_AA0E18;
        }
      }
    }
  }
  LOBYTE(v79) = 0;
  if ( v88 != 0 || v78 == 0 || v21[195] != 4 )
  {
    if ( v83 == 0 )
      goto LABEL_138;
    goto LABEL_142;
  }
  if ( v83 != 0 )
    goto LABEL_147;
  *(_QWORD *)&v97 = (unsigned int)sub_65C780(&unk_ABE890);
  if ( (double)*(__int64 *)&v97 * 2.328306437080797e-10 >= 0.7 )
    goto LABEL_138;
  v64 = v21[194];
  v106[0] = 0;
  v106[1] = 0;
  v107 = 512;
  v108 = 512;
  if ( (unsigned __int8)sub_5A08D0(v64, 0.0099999998, (int)v106, (int)&v93, 1) == 0
    || (v78 = sub_5A0160(v21[194], 6, 0, 0, 512, 512, 0, 0)) == 0 )
  {
LABEL_151:
    v72 = v21[194];
    sub_578350(&stru_87F7E8);
    for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
    {
      v84 = *(_DWORD *)(j + 36);
      v74 = (char *)dword_ABED10 + 80 * (__int16)v84 + 80 * dword_89C2DC * SHIWORD(v84);
      if ( *((_DWORD *)v74 + 14) == v72 )
      {
        *((_DWORD *)v74 + 14) = 0;
        v74[75] = 0;
        *(_DWORD *)(j + 56) = 0;
        *(_BYTE *)(j + 282) = 0;
        *(_BYTE *)(j + 283) = v21[195];
      }
    }
    if ( v88 > 0 )
    {
      v75 = v21[194] - 1;
      sub_578350(&stru_87F7E8);
      for ( k = sub_578290(&stru_87F7E8); k != 0; k = sub_578290(&stru_87F7E8) )
      {
        v84 = *(_DWORD *)(k + 36);
        v77 = (char *)dword_ABED10 + 80 * (__int16)v84 + 80 * dword_89C2DC * SHIWORD(v84);
        if ( *((_DWORD *)v77 + 14) == v75 )
        {
          *((_DWORD *)v77 + 14) = 0;
          v77[75] = 0;
          *(_DWORD *)(k + 56) = 0;
          *(_BYTE *)(k + 282) = 0;
          *(_BYTE *)(k + 283) = v21[195];
        }
      }
    }
    return 0;
  }
  v65 = v21[194];
  sub_578350(&stru_87F7E8);
  for ( m = sub_578290(&stru_87F7E8); m != 0; m = sub_578290(&stru_87F7E8) )
  {
    v67 = *(_DWORD *)(m + 36);
    v84 = v67;
    if ( dword_ABED10 != nullptr )
      v68 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v67 + 20 * dword_89C2DC * SHIWORD(v84) + 14);
    else
      v68 = -1;
    if ( v68 != v65 )
      *(_BYTE *)(m + 283) += 4;
  }
  LOBYTE(v79) = 1;
LABEL_138:
  if ( v78 == 0 )
  {
LABEL_142:
    v69 = v88 <= 0;
    goto LABEL_143;
  }
  v69 = v88 <= 0;
  if ( v88 == 0 )
  {
    if ( (_BYTE)v79 == 0 )
    {
      v70 = sub_5A0160(v21[194], 2, 0, 0, 512, 512, 0, 0);
      goto LABEL_146;
    }
    goto LABEL_147;
  }
LABEL_143:
  if ( !v69 )
  {
    if ( v78 == 0 )
      goto LABEL_151;
    v70 = sub_5A0160(v21[194], 2, 0, 0, 512, 512, 1, v21[195]);
LABEL_146:
    v78 = v70;
  }
LABEL_147:
  if ( v78 == 0 )
    goto LABEL_151;
  if ( (_BYTE)v79 != 0 )
    v21[195] += 4;
  v21[193] += v81;
  return 1;
}
