// 0x58c800 Region_FloodHelper size=68E

int __thiscall sub_58C800(int this)
{
  int v2; // esi
  int v3; // eax
  int v4; // edx
  size_t v5; // edx
  int i; // ebx
  int v7; // edi
  char *v8; // eax
  int v9; // esi
  int v10; // eax
  int *v11; // eax
  int *v12; // eax
  int v13; // eax
  int v14; // eax
  int v15; // ecx
  char v16; // bl
  int v17; // ebp
  unsigned int v18; // esi
  unsigned int v19; // eax
  int v20; // edi
  int v21; // edx
  int v22; // esi
  int *v23; // eax
  int v24; // esi
  int j; // eax
  char *v26; // ecx
  char v27; // cl
  int v29; // edx
  __int16 v30; // bp
  int v31; // ecx
  int v32; // esi
  int v33; // edx
  int v34; // edi
  int v35; // esi
  int v36; // eax
  size_t v37; // ebx
  char *v38; // ecx
  char v39; // cl
  int v40; // esi
  char v41; // al
  int v42; // edi
  int v43; // ebp
  int v44; // [esp+10h] [ebp-44h]
  int v45; // [esp+14h] [ebp-40h] BYREF
  size_t v46; // [esp+18h] [ebp-3Ch] BYREF
  int v47; // [esp+1Ch] [ebp-38h]
  int v48; // [esp+20h] [ebp-34h] BYREF
  int v49; // [esp+24h] [ebp-30h]
  int v50; // [esp+28h] [ebp-2Ch] BYREF
  double v51; // [esp+2Ch] [ebp-28h]
  __int64 v52; // [esp+34h] [ebp-20h] BYREF
  void **v53; // [esp+3Ch] [ebp-18h] BYREF
  int v54; // [esp+40h] [ebp-14h]
  int v55; // [esp+44h] [ebp-10h]
  char v56; // [esp+49h] [ebp-Bh]
  int v57; // [esp+4Ch] [ebp-8h]
  int v58; // [esp+50h] [ebp-4h]

  v49 = this;
  v46 = dword_ABED14;
  sub_42FCB0(0, 0);
  v2 = *(_DWORD *)(this + 36);
  v53 = &DynamicVectorClass<Cell>::`vftable';
  v57 = 0;
  v58 = 50000;
  if ( v55 > 0 || (v56 != 0 || v55 == 0) && (unsigned __int8)sub_42F860(v55 + 50000, 0) != 0 )
  {
    v3 = v57++;
    *(_DWORD *)(v54 + 4 * v3) = v2;
  }
  if ( sub_4865D0((int *)this) || (LOBYTE(v47) = 0, sub_4867B0((int *)this)) )
    LOBYTE(v47) = 1;
  v50 = *(char *)(this + 283);
  v4 = v57;
  v48 = 0;
  if ( v57 != 0 )
  {
    do
    {
      v44 = *(_DWORD *)(v54 + 4 * v4 - 4);
      if ( v4 - 1 < v4 )
        v57 = v4 - 1;
      v5 = v46;
      *((_DWORD *)dword_ABED10 + 20 * (__int16)v44 + 20 * dword_89C2DC * SHIWORD(v44) + 15) = v46;
      if ( dword_ABED10 != nullptr )
        *((_DWORD *)dword_ABED10 + 20 * (__int16)v44 + 20 * dword_89C2DC * SHIWORD(v44) + 14) = v5;
      for ( i = 0; i < 8; ++i )
      {
        LODWORD(v51) = *(_DWORD *)sub_42D510(&v52, 4 * (i & 7) + 9041544);
        v45 = LODWORD(v51);
        v7 = dword_ABED04;
        v8 = (char *)dword_ABED10 + 80 * SLOWORD(v51) + 80 * dword_89C2DC * SWORD1(v51);
        v9 = SWORD1(v51) + SLOWORD(v51);
        if ( v9 > dword_ABED04
          && SLOWORD(v51) - SWORD1(v51) < dword_ABED04
          && SWORD1(v51) - SLOWORD(v51) < dword_ABED04
          && v9 <= dword_ABED08
          && *((_DWORD *)v8 + 14) == -1
          && *((_DWORD *)v8 + 15) != v46 )
        {
          *((_DWORD *)v8 + 15) = v46;
          v10 = sub_5657A0(&v45);
          if ( *(char *)(v10 + 283) == v50 )
          {
            v11 = (int *)sub_5657A0(&v45);
            v13 = true;
            if ( !sub_4865D0(v11) )
            {
              v12 = (int *)sub_5657A0(&v45);
              if ( !sub_4867B0(v12) )
                v13 = false;
            }
            if ( v13 == (unsigned __int8)v47
              && (v57 < v55
               || (v56 != 0 || v55 == 0)
               && v58 > 0
               && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v53[2])(&v53, v58 + v55, 0) != 0) )
            {
              v14 = v57++;
              *(_DWORD *)(v54 + 4 * v14) = v45;
            }
          }
          v7 = dword_ABED04;
        }
      }
      v4 = v57;
      v15 = ++v48;
    }
    while ( v57 != 0 );
    if ( v15 >= 75 )
      goto LABEL_84;
  }
  else
  {
    v7 = dword_ABED04;
  }
  if ( (_BYTE)v47 == 0 )
  {
    v16 = 0;
    if ( v46 != 0 )
    {
      v29 = *(_DWORD *)(v49 + 36);
      LODWORD(v51) = v29;
      HIWORD(v48) = HIWORD(v29);
      LOWORD(v48) = v29 - 1;
      v30 = v29 - 1;
      v31 = (__int16)(v29 - 1);
      v32 = SHIWORD(v29) + v31;
      if ( v32 <= v7 || v31 - SWORD1(v51) >= v7 || SWORD1(v51) - v31 >= v7 || v32 > dword_ABED08 )
      {
        LODWORD(v52) = v29;
        v48 = v29 - 0x10000;
        v30 = v29;
      }
      v33 = v30 + SHIWORD(v48);
      if ( v33 > v7 && v30 - SHIWORD(v48) < v7 && SHIWORD(v48) - v30 < v7 && v33 <= dword_ABED08 )
      {
        if ( dword_ABED10 != nullptr )
          v34 = *((_DWORD *)dword_ABED10 + 20 * v30 + 20 * dword_89C2DC * SHIWORD(v48) + 14);
        else
          v34 = -1;
        v35 = *(char *)(sub_5657A0(&v48) + 283);
        sub_578350(&stru_87F7E8);
        v36 = sub_578290(&stru_87F7E8);
        if ( v36 != 0 )
        {
          v37 = v46;
          do
          {
            LODWORD(v51) = *(_DWORD *)(v36 + 36);
            v38 = (char *)dword_ABED10 + 80 * SLOWORD(v51) + 80 * dword_89C2DC * SWORD1(v51);
            if ( *((_DWORD *)v38 + 14) == v37 )
            {
              *((_DWORD *)v38 + 14) = v34;
              v38[75] = 0;
              *(_DWORD *)(v36 + 56) = 0;
              *(_BYTE *)(v36 + 282) = 0;
              v39 = dword_ABE2E4;
              if ( v35 != -1 )
                v39 = v35;
              *(_BYTE *)(v36 + 283) = v39;
            }
            v36 = sub_578290(&stru_87F7E8);
          }
          while ( v36 != 0 );
        }
        goto LABEL_63;
      }
      goto LABEL_84;
    }
    v17 = sub_5A0700(0);
    v45 = v17;
    v18 = *(_DWORD *)(v17 + 16) - 1;
    v52 = *(unsigned int *)(v17 + 16);
    v51 = (double)v52;
    do
    {
      v52 = (unsigned int)sub_65C780(&unk_ABE890);
      v19 = sub_7C5F00((double)v52 * v51 * 2.328306437080797e-10);
    }
    while ( v19 > v18 );
    v20 = 0;
    v46 = *(_DWORD *)(*(_DWORD *)(v17 + 4) + 4 * v19);
    while ( 1 )
    {
      LODWORD(v51) = *(_DWORD *)sub_42D510(&v52, 4 * (v20 & 7) + 9041544);
      v48 = LODWORD(v51);
      v21 = SWORD1(v51) + SLOWORD(v51);
      if ( v21 > dword_ABED04 )
      {
        if ( SLOWORD(v51) - SWORD1(v51) < dword_ABED04
          && SWORD1(v51) - SLOWORD(v51) < dword_ABED04
          && v21 <= dword_ABED08 )
        {
          v22 = sub_5657A0(&v48);
          if ( *(_BYTE *)(v22 + 283) != *(_BYTE *)(sub_5657A0(&v46) + 283) )
          {
            v23 = (int *)sub_5657A0(&v48);
            if ( !sub_4865D0(v23) )
            {
              v24 = *(char *)(sub_5657A0(&v48) + 283);
              sub_578350(&stru_87F7E8);
              for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
              {
                LODWORD(v51) = *(_DWORD *)(j + 36);
                v26 = (char *)dword_ABED10 + 80 * SLOWORD(v51) + 80 * dword_89C2DC * SWORD1(v51);
                if ( *((_DWORD *)v26 + 14) == 0 )
                {
                  *((_DWORD *)v26 + 14) = -1;
                  v26[75] = 0;
                  *(_DWORD *)(j + 56) = 0;
                  *(_BYTE *)(j + 282) = 0;
                  v27 = dword_ABE2E4;
                  if ( v24 != -1 )
                    v27 = v24;
                  *(_BYTE *)(j + 283) = v27;
                }
              }
              v17 = v45;
              v16 = 1;
LABEL_60:
              if ( v17 != 0 )
                (**(void (__thiscall ***)(int, int))v17)(v17, 1);
              if ( v16 != 0 )
              {
LABEL_63:
                v53 = &VectorClass<Cell>::`vftable';
                sub_42F7C0(&v53);
                return 0;
              }
              break;
            }
          }
        }
        v17 = v45;
      }
      if ( ++v20 >= 8 )
        goto LABEL_60;
    }
  }
LABEL_84:
  if ( operator new(0x50u) != nullptr )
    v40 = sub_58BF70(*(_DWORD *)(v49 + 36));
  else
    v40 = 0;
  v41 = v47;
  *(_DWORD *)(v40 + 16) = v50;
  *(_BYTE *)(v40 + 20) = v41;
  *(_DWORD *)(v40 + 12) = 0;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v42 = 0;
    v43 = dword_89C2DC * dword_89C2DC;
    do
    {
      if ( *(_DWORD *)((char *)dword_ABED10 + v42 + 56) == *(_DWORD *)(v40 + 8) )
      {
        v50 = 0;
        if ( (unsigned __int8)sub_5AC370(&v50) != 0 )
          ++*(_DWORD *)(v40 + 12);
      }
      v42 += 80;
      --v43;
    }
    while ( v43 != 0 );
  }
  v53 = &VectorClass<Cell>::`vftable';
  sub_42F7C0(&v53);
  return v40;
}
