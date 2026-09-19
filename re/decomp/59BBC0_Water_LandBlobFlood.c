// 0x59bbc0 Water_LandBlobFlood size=96F

int __thiscall sub_59BBC0(int *this, int a2, _DWORD *a3, int a4, int a5, int a6, double a7, char a8)
{
  int v8; // eax
  int v9; // edi
  void *v10; // eax
  int *v11; // eax
  int *v12; // esi
  void *v13; // eax
  int v14; // ecx
  int v15; // eax
  unsigned int v16; // ebx
  unsigned int v17; // eax
  __int16 v18; // di
  unsigned int v19; // ebx
  unsigned int v20; // eax
  __int16 v21; // cx
  __int16 v22; // ax
  int *v23; // eax
  int result; // eax
  __int16 v25; // dx
  int v26; // eax
  int v27; // edx
  int v28; // eax
  _DWORD *v29; // edi
  unsigned int v30; // ecx
  unsigned int v31; // edx
  int v32; // ebx
  unsigned int v33; // eax
  __int16 *v34; // edi
  int v35; // eax
  double v36; // st6
  int v37; // eax
  char *v38; // ecx
  int v39; // edx
  int v40; // ebx
  char v41; // al
  int v42; // eax
  __int16 v43; // cx
  int v44; // eax
  int v45; // ecx
  char *v46; // edi
  int *v47; // eax
  unsigned int v48; // ebx
  double v49; // st7
  __int16 v50; // ax
  double v51; // st7
  double v52; // st7
  int v53; // ecx
  unsigned int v54; // eax
  unsigned int v55; // ecx
  unsigned int v56; // edi
  unsigned int v57; // edx
  int v58; // edi
  int v59; // ebx
  unsigned int v60; // ecx
  long double v61; // st7
  long double v62; // st7
  int v63; // ecx
  bool v64; // zf
  int v65; // eax
  int v66; // eax
  __int16 *v67; // edi
  int *v68; // ebx
  char *v69; // edi
  int v70; // eax
  int i; // eax
  int v72; // ecx
  int v73; // esi
  int v74; // edi
  int j; // eax
  char *v76; // ecx
  char v77; // [esp+17h] [ebp-81h]
  int v79; // [esp+1Ch] [ebp-7Ch] BYREF
  int v80; // [esp+20h] [ebp-78h] BYREF
  int v81; // [esp+24h] [ebp-74h]
  int v82; // [esp+28h] [ebp-70h]
  int v83; // [esp+2Ch] [ebp-6Ch]
  void *Block; // [esp+30h] [ebp-68h]
  float v85; // [esp+34h] [ebp-64h]
  float v86; // [esp+38h] [ebp-60h]
  int v87; // [esp+3Ch] [ebp-5Ch]
  int v88; // [esp+40h] [ebp-58h]
  int v89; // [esp+44h] [ebp-54h]
  __int64 v90; // [esp+48h] [ebp-50h]
  __int64 v91; // [esp+50h] [ebp-48h]
  int v92; // [esp+58h] [ebp-40h] BYREF
  float v93; // [esp+60h] [ebp-38h]
  double v94; // [esp+68h] [ebp-30h]
  long double v95; // [esp+70h] [ebp-28h]
  long double v96; // [esp+78h] [ebp-20h]
  double v97; // [esp+80h] [ebp-18h]
  double v98; // [esp+88h] [ebp-10h]
  double v99; // [esp+90h] [ebp-8h]

  v8 = a2;
  if ( a2 <= 400 )
  {
    v8 = 400;
    a2 = 400;
  }
  v9 = 8 * v8 + 2;
  if ( v9 <= 100 )
    v9 = 100;
  v89 = v9;
  v10 = operator new(8 * v9);
  if ( v10 != nullptr )
  {
    Block = v10;
    LODWORD(v94) = v9 - 1;
  }
  else
  {
    Block = nullptr;
  }
  v11 = (int *)operator new(0x14u);
  v12 = v11;
  if ( v11 != nullptr )
  {
    v11[3] = 0;
    v11[4] = -1;
    *v11 = 0;
    v11[1] = v9;
    v13 = operator new(4 * v9 + 4);
    v14 = v12[1];
    v12[2] = (int)v13;
    v15 = 0;
    if ( v14 >= 0 )
    {
      do
      {
        ++v15;
        *(_DWORD *)(v12[2] + 4 * v15 - 4) = 0;
      }
      while ( v15 <= v12[1] );
    }
  }
  else
  {
    v12 = nullptr;
  }
  if ( *(_DWORD *)a4 != 0 || *(_DWORD *)(a4 + 4) != 0 )
  {
    v25 = *(_WORD *)(a4 + 4);
    LOWORD(v87) = *(_DWORD *)a4;
    HIWORD(v87) = v25;
    v79 = v87;
LABEL_27:
    v86 = 0.0;
    v85 = 0.0;
    if ( *a3 != dword_ABE2F0 || a3[1] != dword_ABE2F4 || a3[2] != dword_ABE2F8 || a3[3] != dword_ABE2FC )
    {
      v26 = a3[3];
      v83 = a3[2];
      v87 = v26;
      if ( v83 <= v26 )
      {
        v85 = 1.0;
        v86 = (double)v87 / (double)v83 * 1.2;
      }
      else
      {
        v86 = 1.0;
        v85 = (double)v83 / (double)v87 * 1.2;
      }
    }
    LODWORD(v91) = (__int16)v79;
    v27 = *v12;
    LODWORD(v91) = SHIWORD(v79);
    v28 = 0;
    v95 = (double)(__int16)v79;
    v81 = 0;
    v96 = (double)SHIWORD(v79);
    if ( v27 >= 0 )
    {
      do
      {
        ++v28;
        *(_DWORD *)(v12[2] + 4 * v28 - 4) = 0;
      }
      while ( v28 <= *v12 );
    }
    v29 = Block;
    *v12 = 0;
    v82 = 1;
    *v29 = v79;
    v29[1] = 0;
    *((_DWORD *)dword_ABED10 + 20 * (__int16)v79 + 20 * dword_89C2DC * SHIWORD(v79) + 15) = *(this + 194);
    v30 = *v12 + 1;
    LODWORD(v91) = v29[1];
    v31 = v30 >> 1;
    if ( v30 < v12[1] )
    {
      for ( ; v30 > 1; v31 >>= 1 )
      {
        v32 = v12[2];
        if ( *(float *)(*(_DWORD *)(v32 + 4 * v31) + 4) <= (double)*(float *)&v91 )
          break;
        *(_DWORD *)(v32 + 4 * v30) = *(_DWORD *)(v32 + 4 * v31);
        v30 = v31;
      }
      *(_DWORD *)(v12[2] + 4 * v30) = v29;
      v33 = v12[3];
      ++*v12;
      if ( (unsigned int)v29 > v33 )
        v12[3] = (int)v29;
      if ( (unsigned int)v29 < v12[4] )
        v12[4] = (int)v29;
    }
    if ( *v12 != 0 )
    {
      v35 = v12[2];
      v34 = *(__int16 **)(v35 + 4);
      *(_DWORD *)(v35 + 4) = *(_DWORD *)(v35 + 4 * *v12);
      *(_DWORD *)(v12[2] + 4 * (*v12)--) = 0;
      sub_5AD870(1);
    }
    else
    {
      v34 = nullptr;
    }
    v83 = (int)v34;
    v36 = (double)(int)a3[2] * 0.5;
    v98 = 1.0 / (v36 * v36);
    v97 = 1.0 / ((double)(int)a3[3] * 0.5 * ((double)(int)a3[3] * 0.5));
    do
    {
      if ( v34 == nullptr )
        break;
      if ( dword_ABED10 != nullptr )
        *((_DWORD *)dword_ABED10 + 20 * *v34 + 20 * dword_89C2DC * v34[1] + 14) = *(this + 194);
      v37 = sub_5657A0(v34);
      v38 = (char *)Block;
      v39 = v82;
      *(_DWORD *)(v37 + 56) = 0;
      v40 = dword_ABED04;
      v41 = 0;
      LODWORD(v91) = 0;
      LODWORD(v90) = &v38[8 * v39];
      while ( 1 )
      {
        v42 = v41 & 7;
        v43 = v34[1] + HIWORD(dword_89F688[v42]);
        LOWORD(v88) = *v34 + LOWORD(dword_89F688[v42]);
        HIWORD(v88) = v43;
        v80 = v88;
        v44 = v43;
        v45 = v43 + (__int16)v88;
        if ( v45 > v40 && (__int16)v88 - v44 < v40 && v44 - (__int16)v88 < v40 && v45 <= dword_ABED08 )
        {
          v46 = (char *)dword_ABED10 + 80 * (__int16)v88 + 80 * dword_89C2DC * v44;
          if ( *((_DWORD *)v46 + 14) == 0 && *((_DWORD *)v46 + 15) != *(this + 194) )
          {
            v47 = (int *)sub_5657A0(&v80);
            if ( sub_4865D0(v47) && v82 < v89 && (unsigned __int8)sub_59BAB0((int)&v80, (int)a3, a5, v98, v97) != 0 )
            {
              v48 = v90;
              v49 = v95 + 0.5;
              *(_DWORD *)v90 = v80;
              LOWORD(v87) = sub_7C5F00(v49);
              v50 = sub_7C5F00(v96 + 0.5);
              HIWORD(v87) = v50;
              v92 = v87;
              if ( a8 != 0 )
              {
                sub_59B940((int)&v92, (int)&v80, (int)a3, a6, v86, v85);
              }
              else
              {
                LODWORD(v90) = (SHIWORD(v80) - v50) * (SHIWORD(v80) - v50)
                             + ((__int16)v80 - (__int16)v87) * ((__int16)v80 - (__int16)v87);
                v52 = (double)(int)v90;
                sub_4CAC40(v52);
                v94 = v52;
                *(_QWORD *)&v99 = (unsigned int)sub_65C780(&unk_ABE890);
                v51 = (double)*(__int64 *)&v99 * 5.0 * 2.328306437080797e-10 + v94;
              }
              v53 = v82;
              *(float *)(v48 + 4) = v51;
              *((_DWORD *)v46 + 15) = *(this + 194);
              v54 = v48;
              v82 = v53 + 1;
              v55 = *v12 + 1;
              v93 = *(float *)(v48 + 4);
              v56 = v12[1];
              v57 = v55 >> 1;
              LODWORD(v94) = v48;
              LODWORD(v90) = v48 + 8;
              if ( v55 < v56 )
              {
                if ( v55 > 1 )
                {
                  do
                  {
                    v58 = v12[2];
                    v59 = *(_DWORD *)(v58 + 4 * v57);
                    if ( *(float *)(v59 + 4) <= (double)v93 )
                      break;
                    *(_DWORD *)(v58 + 4 * v55) = v59;
                    v55 = v57;
                    v57 >>= 1;
                  }
                  while ( v55 > 1 );
                  v54 = LODWORD(v94);
                }
                *(_DWORD *)(v12[2] + 4 * v55) = v54;
                v60 = v12[3];
                ++*v12;
                if ( v54 > v60 )
                  v12[3] = v54;
                if ( v54 < v12[4] )
                  v12[4] = v54;
              }
            }
            v40 = dword_ABED04;
          }
        }
        v41 = v91 + 2;
        LODWORD(v91) = v91 + 2;
        if ( (int)v91 >= 8 )
          break;
        v34 = (__int16 *)v83;
      }
      v61 = sub_5980C0((double *)&byte_ABDFB8);
      v95 = v61 * a7 + v95;
      v62 = sub_5980C0((double *)&byte_ABDFB8);
      ++v81;
      v63 = *v12;
      v64 = *v12 == 0;
      v96 = v62 * a7 + v96;
      if ( v64 )
      {
        v34 = nullptr;
      }
      else
      {
        v65 = v12[2];
        v34 = *(__int16 **)(v65 + 4);
        *(_DWORD *)(v65 + 4) = *(_DWORD *)(v65 + 4 * v63);
        *(_DWORD *)(v12[2] + 4 * (*v12)--) = 0;
        sub_5AD870(1);
      }
      v83 = (int)v34;
    }
    while ( v81 < a2 );
    if ( *v12 != 0 )
    {
      v66 = v12[2];
      v67 = *(__int16 **)(v66 + 4);
      *(_DWORD *)(v66 + 4) = *(_DWORD *)(v66 + 4 * *v12);
      *(_DWORD *)(v12[2] + 4 * (*v12)--) = 0;
      sub_5AD870(1);
      for ( ; v67 != nullptr; ++v81 )
      {
        v68 = (int *)sub_5657A0(v67);
        v69 = (char *)dword_ABED10 + 80 * *v67 + 80 * dword_89C2DC * v67[1];
        if ( *((_DWORD *)v69 + 14) == 0 && sub_4865D0(v68) )
        {
          v68[14] = 0;
          *((_DWORD *)v69 + 14) = *(this + 194);
        }
        if ( *v12 != 0 )
        {
          v70 = v12[2];
          v67 = *(__int16 **)(v70 + 4);
          *(_DWORD *)(v70 + 4) = *(_DWORD *)(v70 + 4 * *v12);
          *(_DWORD *)(v12[2] + 4 * (*v12)--) = 0;
          sub_5AD870(1);
        }
        else
        {
          v67 = nullptr;
        }
      }
    }
    operator delete(Block);
    if ( v12 != nullptr )
    {
      operator delete((void *)v12[2]);
      operator delete(v12);
    }
    v77 = sub_57A0C0(*(this + 194), 1);
    sub_578350(&stru_87F7E8);
    for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
    {
      v72 = *(_DWORD *)(i + 56);
      if ( v72 >= dword_ABAD28 && v72 < dword_ABAD28 + 42 )
      {
        *(_DWORD *)(i + 56) = 0;
        *(_BYTE *)(i + 282) = 0;
      }
    }
    if ( v77 != 0 )
    {
      result = v81;
      ++*(this + 194);
    }
    else
    {
      v73 = dword_AA0738;
      v74 = *(this + 194);
      sub_578350(&stru_87F7E8);
      for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
      {
        LODWORD(v94) = *(_DWORD *)(j + 36);
        v76 = (char *)dword_ABED10 + 80 * SLOWORD(v94) + 80 * dword_89C2DC * SWORD1(v94);
        if ( *((_DWORD *)v76 + 14) == v74 )
        {
          *((_DWORD *)v76 + 14) = 0;
          v76[75] = 0;
          *(_DWORD *)(j + 56) = v73;
          *(_BYTE *)(j + 282) = 0;
          *(_BYTE *)(j + 283) = *(this + 195);
        }
      }
      return 0;
    }
  }
  else
  {
    v83 = 0;
    while ( 1 )
    {
      v16 = dword_87F8DC - 1;
      *(_QWORD *)&v96 = (unsigned int)dword_87F8DC;
      v99 = (double)(unsigned int)dword_87F8DC;
      do
      {
        *(_QWORD *)&v95 = (unsigned int)sub_65C780(&unk_ABE890);
        v17 = sub_7C5F00((double)*(__int64 *)&v95 * v99 * 2.328306437080797e-10);
        v18 = v17;
      }
      while ( v17 > v16 );
      v19 = dword_87F8E0 - 1;
      v91 = (unsigned int)dword_87F8E0;
      v99 = (double)(unsigned int)dword_87F8E0;
      do
      {
        v90 = (unsigned int)sub_65C780(&unk_ABE890);
        v20 = sub_7C5F00((double)v90 * v99 * 2.328306437080797e-10);
      }
      while ( v20 > v19 );
      HIWORD(v92) = -v18;
      HIWORD(v93) = dword_87F8DC;
      LOWORD(v94) = v18 + 1;
      WORD1(v94) = dword_87F8DC - v18;
      v21 = v20 + v18 + 1;
      v22 = dword_87F8DC - v18 + v20;
      LOWORD(v87) = v21;
      HIWORD(v87) = v22;
      v79 = v87;
      if ( ++v83 >= 200 )
        return 0;
      if ( dword_ABED10 != nullptr && *((_DWORD *)dword_ABED10 + 20 * v21 + 20 * dword_89C2DC * v22 + 14) == 0 )
      {
        v23 = (int *)sub_5657A0(&v79);
        if ( sub_4865D0(v23) )
        {
          if ( v83 < 200 )
            goto LABEL_27;
          return 0;
        }
      }
    }
  }
  return result;
}
